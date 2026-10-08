// src/services/resultsExport.ts
// ============================================================
// PDF Report Cards + PDF Analysis generator & downloader.
// (No Excel export — every export in this file is a PDF.)
//
// - PDF Report Cards: one page per student, matches the sample report
//   cards PDF (band-key legend + Page X of Y footer included).
// - PDF Analysis: class performance summary + merit list + subject grade
//   distribution report + comparison with the previous exam, matching the
//   sample `MERIT_LIST_...` / `GRADE_DISTRIBUTION_...` PDFs. Reads
//   admNo/stream/points/prev-term fields returned by my_results.php.
//
// Downloads:
//   Android -> StorageAccessFramework writes to user-chosen folder
//              (defaults to Downloads), survives app reinstalls.
//   iOS     -> writes to cacheDirectory then opens share sheet
//              ("Save to Files").
//   Web     -> triggers a normal browser download.
// ============================================================

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { Platform } from "react-native";

/* ────────────────────────────────────────────────────────────
   Types (mirror StaffDashboard in results.tsx)
   ──────────────────────────────────────────────────────────── */
export type Meta = {
  gradeInt: number;
  isLowerGrade: boolean;
  term: string;
  examType: string;
  examLabel: string;
  year: string;
  studentCount: number;
  subjectCount: number;
  totalOutOf: number;
  classMeanTotal: number;
  classMeanSubject: number;
  generatedAt: string;
};

export type BandsOverall = {
  ee: number; eeP: number;
  me: number; meP: number;
  ae: number; aeP: number;
  be: number; beP: number;
};

export type BreakdownRow = {
  code: string;
  label: string;
  count: number;
  pct: number;
};

export type SplitBands = {
  EE1: number; EE2: number; ME1: number; ME2: number;
  AE1: number; AE2: number; BE1: number; BE2: number;
};

export type SubjectSummary = {
  code: string;
  label: string;
  mean: number;
  tier: "ee" | "me" | "ae" | "be";
  bands: { ee: number; me: number; ae: number; be: number };
  // NEW — populated by the updated my_results.php:
  splitBands?: SplitBands;
  entry?: number;
  avgPoints?: number;
  prevPoints?: number | null;
  teacher?: string;
};

export type StudentSubject = {
  code: string;
  label: string;
  score: number;
  bandCode: string;
};

export type StudentRow = {
  rank: number;
  assesment: string;
  firstName: string;
  lastName: string;
  subjects: StudentSubject[];
  total: number;
  bandCode: string;
  // NEW — populated by the updated my_results.php:
  admNo?: string;
  stream?: string;
  streamPos?: number;
  totalPoints?: number;
  avgPoints?: number;
  prevOverallPos?: number | null;
  prevStreamPos?: number | null;
  prevPoints?: number | null;
};

export type ClassMeanRow = {
  subjects: { code: string; label: string; score: number }[];
  total: number;
  bandCode: string;
};

export type StaffDashboard = {
  success: boolean;
  grade: string;
  studentCount: number;
  message?: string;
  meta?: Meta;
  kpis?: {
    totalStudents: number;
    exceedingCount: number;
    exceedingPct: number;
    belowCount: number;
    belowPct: number;
  };
  bands?: { overall: BandsOverall; breakdown: BreakdownRow[] };
  subjects?: SubjectSummary[];
  comparison?: {
    hasPrevious: boolean;
    previousLabel: string;
    subjects: any[];
    classMeanCurrent: number;
    classMeanPrevious: number;
    studentCountPrevious: number;
  };
  students?: StudentRow[];
  classMeanRow?: ClassMeanRow;
};

/* ────────────────────────────────────────────────────────────
   Band palette + teacher comment mapping
   ──────────────────────────────────────────────────────────── */
const BAND_FG: Record<string, string> = {
  "E.E": "#16A34A", "M.E": "#1A4A7A", "A.E": "#B45309", "B.E": "#991B1B",
  EE2: "#15803D", EE1: "#16A34A",
  ME2: "#123657", ME1: "#1A4A7A",
  AE2: "#92400E", AE1: "#B45309",
  BE2: "#7F1D1D", BE1: "#991B1B",
};
const BAND_BG: Record<string, string> = {
  "E.E": "#DCFCE7", "M.E": "#DCE8F5", "A.E": "#FEF3C7", "B.E": "#FEE2E2",
  EE2: "#BBF7D0", EE1: "#DCFCE7",
  ME2: "#CFE0F3", ME1: "#DCE8F5",
  AE2: "#FDE68A", AE1: "#FEF3C7",
  BE2: "#FECACA", BE1: "#FEE2E2",
};
const bandFg = (c: string) => BAND_FG[c] ?? "#3D4F5C";
const bandBg = (c: string) => BAND_BG[c] ?? "#F2EFEA";

function tierLabel(tier: "ee" | "me" | "ae" | "be"): string {
  return tier === "ee" ? "Exceeding Expectation"
       : tier === "me" ? "Meeting Expectation"
       : tier === "ae" ? "Approaching Expectation"
       : "Below Expectation";
}

function teacherComment(bandCode: string): string {
  switch (bandCode) {
    case "E.E": case "EE1": case "EE2":
      return "An excellent performance this term. Keep up the great work!";
    case "M.E": case "ME1": case "ME2":
      return "A good, solid performance. Keep striving for even better results.";
    case "A.E": case "AE1": case "AE2":
      return "Fair performance — more effort and practice will help improve these results.";
    case "B.E": case "BE1": case "BE2":
      return "Performance needs significant improvement. Extra support at home and school is advised.";
    default:
      return "Keep working hard and aim higher.";
  }
}

/* ────────────────────────────────────────────────────────────
   Filename helper
   ──────────────────────────────────────────────────────────── */
function safeSlug(s: string): string {
  return String(s).replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
}

/* ────────────────────────────────────────────────────────────
   Cross-platform "save a base64 file" helper
   ──────────────────────────────────────────────────────────── */
async function saveBase64File(
  base64: string,
  filename: string,
  mimeType: string,
  dialogTitle: string,
): Promise<{ uri: string; filename: string }> {
  /* ── Web: trigger a normal browser download ── */
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = `data:${mimeType};base64,${base64}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { uri: filename, filename };
  }

  /* ── Android: write straight to user-chosen folder (defaults to Downloads) ── */
  if (Platform.OS === "android") {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) throw new Error("Folder permission was not granted.");

    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      perm.directoryUri,
      filename,
      mimeType,
    );
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri: fileUri, filename };
  }

  /* ── iOS: write to cache, then open share sheet ("Save to Files") ── */
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle,
      UTI: mimeType,
    });
  }
  return { uri, filename };
}

/* ============================================================
   PDF REPORT CARDS
   Produces GradeX_<Exam>_TermY_<Year>_ReportCards.pdf
   ============================================================ */
function isSplitBand(bandCode: string): boolean {
  return /^(EE|ME|AE|BE)[12]$/.test(bandCode);
}

function legendLine(sampleBandCode: string): string {
  if (isSplitBand(sampleBandCode)) {
    return `Key: EE1/EE2 Exceeding Expectation (75-100) &nbsp;|&nbsp; ME1/ME2 Meeting Expectation (50-74) &nbsp;|&nbsp; AE1/AE2 Approaching Expectation (26-49) &nbsp;|&nbsp; BE1/BE2 Below Expectation (0-25)`;
  }
  return `Key: E.E Exceeding Expectation (75-100) &nbsp;|&nbsp; M.E Meeting Expectation (50-74) &nbsp;|&nbsp; A.E Approaching Expectation (26-49) &nbsp;|&nbsp; B.E Below Expectation (0-25)`;
}

function buildReportCardsHtml(d: StaffDashboard): string {
  if (!d.meta || !d.students || !d.subjects) {
    return "<html><body><p>No data</p></body></html>";
  }
  const meta = d.meta;
  const totalOutOf = meta.totalOutOf;
  const totalStudents = meta.studentCount;

  const pages = d.students.map((s) => {
    const totalFg = bandFg(s.bandCode);
    const totalBg = bandBg(s.bandCode);

    const subjectRows = s.subjects
      .map((sub) => {
        const fg = bandFg(sub.bandCode);
        const bg = bandBg(sub.bandCode);
        return `<tr>
          <td style="text-align:left">${sub.label}</td>
          <td style="text-align:center;font-weight:600">${sub.score}</td>
          <td style="text-align:center;background:${bg};color:${fg};font-weight:700">${sub.bandCode}</td>
        </tr>`;
      })
      .join("");

    return `
      <div class="page">
        <div class="header">
          <div class="school">Stephen Kanja Primary &amp; Junior School</div>
          <div class="sub">ACADEMIC PERFORMANCE REPORT CARD</div>
          <div class="meta">Grade ${d.grade} &nbsp;|&nbsp; ${meta.examLabel} &nbsp;|&nbsp; Term ${meta.term}, ${meta.year}</div>
        </div>

        <div class="studentRow">
          <h2>${s.firstName} ${s.lastName}</h2>
          <div class="position">Position: <strong>${s.rank}</strong> of ${totalStudents}</div>
        </div>

        <p class="assess">Assessment No: ${s.assesment || ""}</p>

        <div class="badges">
          <div class="badge" style="background:${totalBg};color:${totalFg}">
            Total: ${s.total}/${totalOutOf} (${s.bandCode})
          </div>
        </div>

        <table class="marks">
          <thead>
            <tr>
              <th style="width:55%">Subject</th>
              <th style="width:20%">Score (/100)</th>
              <th style="width:25%">Level</th>
            </tr>
          </thead>
          <tbody>${subjectRows}</tbody>
        </table>

        <div class="summaryLine">
          Total Score: <strong>${s.total} / ${totalOutOf}</strong> &nbsp;&nbsp;
          Class Mean: <strong>${meta.classMeanTotal} / ${totalOutOf}</strong> &nbsp;&nbsp;
          Class Position: <strong>${s.rank}</strong> out of <strong>${totalStudents}</strong> students
        </div>

        <div class="commentBox">
          <div class="commentLabel">TEACHER'S COMMENT</div>
          <div class="commentText">${teacherComment(s.bandCode)}</div>
        </div>

        <div class="legend">${legendLine(s.bandCode)}</div>

        <div class="sig">
          <div>Class Teacher: ____________________</div>
          <div>Head of Institution: ____________________</div>
        </div>

        <div class="pageFooter">Page ${s.rank} of ${totalStudents}</div>
      </div>
    `;
  }).join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 14mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Helvetica, Arial, sans-serif; color: #0F1923; margin: 0; }
          .page { page-break-after: always; padding: 8px 4px 24px; position: relative; min-height: 250mm; }
          .page:last-child { page-break-after: auto; }

          .header { background: #0F1923; color: #fff; padding: 14px 18px; border-radius: 6px; margin-bottom: 16px; }
          .school { font-weight: 800; font-size: 16px; letter-spacing: 0.5px; }
          .sub    { color: #C8992A; font-size: 10px; letter-spacing: 1.5px; margin-top: 3px; }
          .meta   { color: #C9CCD1; font-size: 10px; margin-top: 6px; }

          .studentRow { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
          h2 { margin: 0; font-size: 20px; color: #0F1923; }
          .position { font-size: 12px; color: #7A909E; }
          .position strong { color: #0F1923; }
          .assess { color: #7A909E; font-size: 11px; margin: 4px 0 12px; }

          .badges { display: flex; gap: 8px; margin-bottom: 14px; }
          .badge { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; }

          table.marks { width: 100%; border-collapse: collapse; margin-top: 4px; }
          table.marks th, table.marks td { border: 1px solid #E5E3DE; padding: 8px 10px; font-size: 12px; }
          table.marks th {
            background: #0F1923; color: #fff; text-align: left; font-size: 11px;
            text-transform: uppercase; letter-spacing: 0.5px;
          }

          .summaryLine { font-size: 11.5px; margin-top: 14px; color: #3D4F5C; }
          .summaryLine strong { color: #0F1923; }

          .commentBox { margin-top: 18px; padding: 12px 14px; background: #FAFAF7; border-left: 3px solid #C8992A; border-radius: 4px; }
          .commentLabel { font-size: 10px; font-weight: 800; letter-spacing: 1.2px; color: #7A5A10; margin-bottom: 6px; }
          .commentText { font-size: 12px; color: #0F1923; line-height: 1.5; }

          .legend { margin-top: 14px; font-size: 9.5px; color: #7A909E; }

          .sig { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11px; color: #3D4F5C; }

          .pageFooter { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #B7BBC1; }
        </style>
      </head>
      <body>${pages}</body>
    </html>
  `;
}

/* expo-print's printToFileAsync is iOS/Android only. On web, Print.printAsync
   does NOT isolate the given `html` — it just triggers window.print() on
   the current document, so the browser prints the live app (sidebar, all)
   instead of our report. Fix: load the html into its own offscreen
   <iframe> (via srcdoc, so it gets an isolated document + <style>, with
   no access to the live app's DOM) and print *that* frame instead. The
   html's own `@page { size: A4 portrait/landscape }` rule (already set in
   buildReportCardsHtml / the analysis styles below) drives the print
   dialog's orientation automatically — no extra plumbing needed here.
   (We tried a real client-side PDF via html2canvas+jsPDF first, but
   html2canvas's package "main" field can't be resolved by Expo's Metro
   bundler out of the box — not worth fighting that for this.) */
async function printHtmlInIsolatedFrame(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    const cleanup = () => {
      // Give the browser's print dialog a moment to open before we
      // remove the frame it's printing from.
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };
    iframe.onerror = () => {
      cleanup();
      reject(new Error("Failed to load the print frame."));
    };
  });
}

async function renderHtmlToPdfOrNull(
  html: string,
  filename: string,
): Promise<{ uri: string; filename: string } | null> {
  if (Platform.OS === "web") {
    await printHtmlInIsolatedFrame(html);
    return { uri: filename, filename };
  }
  return null; // signals "continue with the native file-based flow below"
}

export async function exportReportCardsPdf(
  d: StaffDashboard,
): Promise<{ uri: string; filename: string }> {
  const html = buildReportCardsHtml(d);
  const filename = `Grade${d.grade}_${safeSlug(d.meta?.examLabel ?? "Exam")}_Term${d.meta?.term ?? ""}_${d.meta?.year ?? ""}_ReportCards.pdf`;

  const webResult = await renderHtmlToPdfOrNull(html, filename);
  if (webResult) return webResult;

  // Native (iOS/Android): render to a temp PDF file, then read it back as
  // base64 so we can place it wherever the user wants.
  const { uri: tempUri } = await Print.printToFileAsync({ html });
  const base64 = await FileSystem.readAsStringAsync(tempUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return saveBase64File(base64, filename, "application/pdf", "Save Report Cards");
}

/* ============================================================
   PDF ANALYSIS (merit list + subject grade distribution)
   Produces GradeX_<Exam>_TermY_<Year>_Analysis.pdf
   Reads admNo/stream/points/prev-term fields from the updated
   my_results.php — see the optional fields added to StudentRow
   and SubjectSummary above.
   ============================================================ */
function levelFromAvgPoints(avg: number): string {
  // App convention: "2" is the higher sub-band (EE2 = top), matching the PHP points scale.
  if (avg >= 7.5) return "EE2";
  if (avg >= 6.5) return "EE1";
  if (avg >= 5.5) return "ME2";
  if (avg >= 4.5) return "ME1";
  if (avg >= 3.5) return "AE2";
  if (avg >= 2.5) return "AE1";
  if (avg >= 1.5) return "BE2";
  return "BE1";
}

// Short header codes for the merit list's subject columns, matching the
// sample (ENG, KIS, MAT, INT/SC, CAS, SST, C.R.E, I.R.E, AGRI, PRE TECH).
// Falls back to an 8-char slug of the label/code for anything not listed,
// so a subject added later still renders something reasonable.
const SUBJECT_ABBREV: Record<string, string> = {
  english: "ENG",
  kiswahili: "KIS",
  mathematics: "MAT",
  integratedscience: "INT/SC",
  creativeartsandsports: "CAS",
  socialstudies: "SST",
  christianreligiouseducation: "C.R.E",
  cre: "C.R.E",
  islamicreligiouseducation: "I.R.E",
  ire: "I.R.E",
  agriculture: "AGRI",
  pretechnicalstudies: "PRE TECH",
  pretechnical: "PRE TECH",
};
function abbreviateSubject(label: string, code: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  return SUBJECT_ABBREV[slug(label)] ?? SUBJECT_ABBREV[slug(code)] ?? label.slice(0, 8).toUpperCase();
}

// Identity + position columns before the subject columns (used to size the
// colspan on the AVERAGE MARKS / AVERAGE POINTS / PERFORMANCE LEVEL rows).
const MERIT_IDENTITY_COL_COUNT = 9; // S.No, ADM No., Student Name, Ass No, Stream, Stream Pos, Overall Pos, Prv Str, Prv Ovr
const MERIT_TRAILING_COL_COUNT = 6; // Sub Entry, Total Marks, Avg Marks, Total Pts, Avg Pts, Level

function buildMeritListHtml(d: StaffDashboard): string {
  const meta = d.meta!;
  const subjects = d.subjects!;
  const students = d.students!;

  const headerRow = `
    <tr>
      <th>S.No</th><th>ADM No.</th><th>Student Name</th><th>Ass No</th><th>Stream</th>
      <th>Stream<br/>Pos</th><th>Overall<br/>Pos</th><th>Prv<br/>Str</th><th>Prv<br/>Ovr</th>
      ${subjects.map((s) => `<th>${abbreviateSubject(s.label, s.code)}</th>`).join("")}
      <th>Sub.<br/>Entry</th><th>Total<br/>Marks</th><th>Avg<br/>Marks</th>
      <th>Total<br/>Points</th><th>Avg<br/>Points</th><th>Level</th>
    </tr>`;

  const rows = students
    .map((s, i) => {
      const totalPoints = s.totalPoints ?? 0;
      const avgPoints = s.avgPoints ?? 0;
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${s.admNo ?? ""}</td>
        <td style="text-align:left;font-weight:600">${s.firstName} ${s.lastName}</td>
        <td>${s.assesment ?? ""}</td>
        <td>${s.stream ?? "A"}</td>
        <td>${s.streamPos ?? s.rank}</td>
        <td style="font-weight:700">${s.rank}</td>
        <td>${s.prevStreamPos ?? "—"}</td>
        <td>${s.prevOverallPos ?? "—"}</td>
        ${s.subjects.map((sub) => `<td style="background:${bandBg(sub.bandCode)};color:${bandFg(sub.bandCode)}">${sub.score} ${sub.bandCode}</td>`).join("")}
        <td>${s.subjects.length}</td>
        <td style="font-weight:700">${s.total}</td>
        <td>${(s.total / s.subjects.length).toFixed(1)}</td>
        <td>${totalPoints}</td>
        <td>${avgPoints.toFixed(2)}</td>
        <td style="background:${bandBg(s.bandCode)};color:${bandFg(s.bandCode)};font-weight:700">${s.bandCode}</td>
      </tr>`;
    })
    .join("");

  // ── Summary rows: per-subject average marks (%), average points, and
  //    performance level — matching AVERAGE MARKS / AVERAGE POINTS /
  //    PERFORMANCE LEVEL at the bottom of the sample merit list. ──
  const avgMarksRow = `
    <tr class="summaryRow">
      <td colspan="${MERIT_IDENTITY_COL_COUNT}" style="text-align:right;font-weight:700">AVERAGE MARKS</td>
      ${subjects.map((s) => `<td style="font-weight:700">${s.mean.toFixed(2)}%</td>`).join("")}
      <td colspan="${MERIT_TRAILING_COL_COUNT}"></td>
    </tr>`;
  const avgPointsRow = `
    <tr class="summaryRow">
      <td colspan="${MERIT_IDENTITY_COL_COUNT}" style="text-align:right;font-weight:700">AVERAGE POINTS</td>
      ${subjects.map((s) => `<td style="font-weight:700">${(s.avgPoints ?? 0).toFixed(4)}</td>`).join("")}
      <td colspan="${MERIT_TRAILING_COL_COUNT}"></td>
    </tr>`;
  const levelRow = `
    <tr class="summaryRow">
      <td colspan="${MERIT_IDENTITY_COL_COUNT}" style="text-align:right;font-weight:700">PERFORMANCE LEVEL</td>
      ${subjects
        .map((s) => {
          const lvl = levelFromAvgPoints(s.avgPoints ?? 0);
          return `<td style="background:${bandBg(lvl)};color:${bandFg(lvl)};font-weight:700">${lvl}</td>`;
        })
        .join("")}
      <td colspan="${MERIT_TRAILING_COL_COUNT}"></td>
    </tr>`;

  const classAvgMarks = (meta.classMeanTotal ?? 0).toFixed(1);

  return `
    <div class="page">
      <div class="reportHeader">
        <div class="school">Stephen Kanja Junior School</div>
        <div class="sub">REPORT: STUDENTS' PERFORMANCE MERIT LIST</div>
        <div class="meta">
          CLASS: GRADE ${d.grade} &nbsp; TERM: ${meta.term} &nbsp; YEAR: ${meta.year} &nbsp;
          EXAM NAME: ${meta.examLabel.toUpperCase()} TERM ${meta.term} ${meta.year} &nbsp;
          EXAM CODE: GRADE ${d.grade}T${meta.year}${meta.examLabel.toUpperCase().replace(/\s+/g, "")}TERM${meta.term}${meta.year}
        </div>
      </div>
      <table class="merit">
        <thead>${headerRow}</thead>
        <tbody>${rows}${avgMarksRow}${avgPointsRow}${levelRow}</tbody>
      </table>
      <div class="notes">
        <div>- CLASS AVERAGE MARKS: ${classAvgMarks}</div>
        <div>- Student position assigned by using Total marks</div>
        <div>- Student performance level calculated using student average marks</div>
      </div>
      <div class="genFooter">Report generated on: ${meta.generatedAt}</div>
    </div>`;
}

function buildClassPerformanceHtml(d: StaffDashboard): string {
  const meta = d.meta!;
  const subjects = d.subjects!;
  const kpis = d.kpis;
  const overall = d.bands?.overall;
  const breakdown = d.bands?.breakdown ?? [];

  const kpiCards = kpis
    ? `
      <div class="kpiCard"><div class="kpiLabel">Total Students</div><div class="kpiVal">${kpis.totalStudents}</div></div>
      <div class="kpiCard"><div class="kpiLabel">Exceeding Expectations</div><div class="kpiVal">${kpis.exceedingCount} <span class="kpiPct">(${kpis.exceedingPct}%)</span></div></div>
      <div class="kpiCard"><div class="kpiLabel">Class Mean</div><div class="kpiVal">${meta.classMeanTotal}/${meta.totalOutOf} <span class="kpiPct">(${meta.classMeanSubject} avg/subject)</span></div></div>
      <div class="kpiCard"><div class="kpiLabel">Below Expectations</div><div class="kpiVal">${kpis.belowCount} <span class="kpiPct">(${kpis.belowPct}%)</span></div></div>`
    : "";

  const bandRows = breakdown
    .map(
      (b) => `
      <tr>
        <td style="text-align:left;background:${bandBg(b.code)};color:${bandFg(b.code)};font-weight:700">${b.code}</td>
        <td style="text-align:left">${b.label}</td>
        <td>${b.count}</td>
        <td>${b.pct}%</td>
      </tr>`,
    )
    .join("");

  const subjectRows = subjects
    .map((s) => {
      return `
      <tr>
        <td style="text-align:left">${s.label}</td>
        <td>${s.mean.toFixed(1)}</td>
        <td style="background:${bandBg(s.tier === "ee" ? "E.E" : s.tier === "me" ? "M.E" : s.tier === "ae" ? "A.E" : "B.E")};color:${bandFg(s.tier === "ee" ? "E.E" : s.tier === "me" ? "M.E" : s.tier === "ae" ? "A.E" : "B.E")};font-weight:700">${tierLabel(s.tier)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="page">
      <div class="reportHeader">
        <div class="school">Stephen Kanja Junior School</div>
        <div class="sub">REPORT: CLASS PERFORMANCE SUMMARY</div>
        <div class="meta">CLASS: GRADE ${d.grade} &nbsp; TERM: ${meta.term} &nbsp; YEAR: ${meta.year} &nbsp; EXAM: ${meta.examLabel.toUpperCase()}</div>
      </div>

      <div class="kpiGrid">${kpiCards}</div>

      <div class="twoCol">
        <div class="twoColItem">
          <div class="subHeading">Achievement Bands (Overall)</div>
          <table>
            <thead><tr><th>Code</th><th style="text-align:left">Meaning</th><th>Students</th><th>%</th></tr></thead>
            <tbody>${bandRows}</tbody>
          </table>
        </div>
        <div class="twoColItem">
          <div class="subHeading">Subject Means (out of 100)</div>
          <table>
            <thead><tr><th style="text-align:left">Subject</th><th>Mean</th><th>Level</th></tr></thead>
            <tbody>${subjectRows}</tbody>
          </table>
        </div>
      </div>

      <div class="genFooter">Report generated on: ${meta.generatedAt}</div>
    </div>`;
}

function buildComparisonHtml(d: StaffDashboard): string {
  const meta = d.meta!;
  const comparison = d.comparison;

  const body = !comparison || !comparison.hasPrevious
    ? `<p class="noPrev">No previous exam data found to compare against.</p>`
    : `
      <div class="kpiGrid">
        <div class="kpiCard"><div class="kpiLabel">Current Class Mean</div><div class="kpiVal">${comparison.classMeanCurrent}</div></div>
        <div class="kpiCard"><div class="kpiLabel">Previous Class Mean (${comparison.previousLabel})</div><div class="kpiVal">${comparison.classMeanPrevious}</div></div>
        <div class="kpiCard"><div class="kpiLabel">Previous Student Count</div><div class="kpiVal">${comparison.studentCountPrevious}</div></div>
      </div>
      <table>
        <thead><tr><th style="text-align:left">Subject</th><th>Current</th><th>Previous</th><th>Change</th></tr></thead>
        <tbody>
          ${comparison.subjects
            .map((s: any) => {
              const arrow = s.change > 0 ? "▲" : s.change < 0 ? "▼" : "→";
              const color = s.change > 0 ? "#16A34A" : s.change < 0 ? "#991B1B" : "#7A909E";
              return `<tr>
                <td style="text-align:left">${s.label}</td>
                <td>${s.current}</td>
                <td>${s.previous}</td>
                <td style="color:${color};font-weight:700">${arrow} ${s.change > 0 ? "+" : ""}${s.change}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

  return `
    <div class="page">
      <div class="reportHeader">
        <div class="school">Stephen Kanja Junior School</div>
        <div class="sub">REPORT: COMPARISON WITH PREVIOUS EXAM</div>
        <div class="meta">CLASS: GRADE ${d.grade} &nbsp; TERM: ${meta.term} &nbsp; YEAR: ${meta.year} &nbsp; EXAM: ${meta.examLabel.toUpperCase()}</div>
      </div>
      ${body}
      <div class="genFooter">Report generated on: ${meta.generatedAt}</div>
    </div>`;
}

function buildDistributionHtml(d: StaffDashboard): string {
  const meta = d.meta!;
  const subjects = d.subjects!;
  const students = d.students!;

  const totalGraded = students.length;
  const avgPointsAll =
    students.reduce((sum, s) => sum + (s.avgPoints ?? 0), 0) / (totalGraded || 1);

  const subjectRows = subjects
    .map((s) => {
      const b = s.splitBands ?? { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
      const entry = s.entry ?? totalGraded;
      const avgPoints = s.avgPoints ?? 0;
      const dev = s.prevPoints != null ? (avgPoints - s.prevPoints).toFixed(4) : "—";
      const lvl = levelFromAvgPoints(avgPoints);
      return `
      <tr>
        <td style="text-align:left">${s.label}</td>
        <td>${b.EE1}</td><td>${b.EE2}</td><td>${b.ME1}</td><td>${b.ME2}</td>
        <td>${b.AE1}</td><td>${b.AE2}</td><td>${b.BE1}</td><td>${b.BE2}</td>
        <td>${entry}</td>
        <td>${s.mean.toFixed(4)}</td>
        <td>${avgPoints.toFixed(4)}</td>
        <td style="background:${bandBg(lvl)};color:${bandFg(lvl)};font-weight:700">${lvl}</td>
        <td>${s.prevPoints != null ? s.prevPoints.toFixed(4) : "—"}</td>
        <td>${dev}</td>
        <td>${s.teacher ?? ""}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="page">
      <div class="reportHeader">
        <div class="school">Stephen Kanja Junior School</div>
        <div class="sub">REPORT: SUBJECT GRADE DISTRIBUTION REPORT</div>
        <div class="meta">CLASS: GRADE ${d.grade} &nbsp; TERM: ${meta.term} &nbsp; YEAR: ${meta.year}</div>
      </div>

      <div class="kpiStrip">
        <div><strong>Graded Students' Count</strong><br/>${totalGraded}</div>
        <div><strong>Average Points</strong><br/>${avgPointsAll.toFixed(4)}</div>
        <div><strong>Level</strong><br/>${levelFromAvgPoints(avgPointsAll)}</div>
      </div>

      <table class="dist">
        <thead><tr>
          <th style="text-align:left">Learning Area</th>
          <th>EE1</th><th>EE2</th><th>ME1</th><th>ME2</th><th>AE1</th><th>AE2</th><th>BE1</th><th>BE2</th>
          <th>Entry</th><th>Avg Marks</th><th>Avg Points</th><th>Level</th><th>Prev Points</th><th>DEV</th><th>Teacher</th>
        </tr></thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="genFooter">Report generated on: ${meta.generatedAt}</div>
    </div>`;
}

const ANALYSIS_STYLES = `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #0F1923; margin: 0; font-size: 7.5px; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .reportHeader { margin-bottom: 8px; }
  .school { font-size: 14px; font-weight: 800; color: #1A4A7A; }
  .sub { font-size: 10px; font-weight: 700; margin-top: 2px; }
  .meta { font-size: 8px; color: #3D4F5C; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table th, table td {
    border: 1px solid #D8D8D8; padding: 2px 3px; text-align: center;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  table th {
    background: #0F1923; color: #fff; font-size: 7px; text-transform: uppercase;
    line-height: 1.25; white-space: normal;
  }
  .merit td { font-size: 7.5px; }
  .summaryRow td { background: #F2EFEA; border-top: 2px solid #0F1923; }
  .notes { margin-top: 8px; font-size: 8px; color: #3D4F5C; line-height: 1.6; }
  .kpiStrip { display: flex; gap: 24px; margin-bottom: 12px; font-size: 11px; }
  .kpiStrip strong { display: block; font-size: 9px; color: #7A909E; }
  .genFooter { margin-top: 10px; font-size: 8px; color: #7A909E; text-align: right; }

  .kpiGrid { display: flex; gap: 10px; margin-bottom: 14px; }
  .kpiCard { flex: 1; border: 1px solid #D8D8D8; border-radius: 4px; padding: 8px 10px; }
  .kpiLabel { font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px; color: #7A909E; margin-bottom: 4px; }
  .kpiVal { font-size: 13px; font-weight: 800; color: #0F1923; }
  .kpiPct { font-size: 9px; font-weight: 400; color: #7A909E; }

  .twoCol { display: flex; gap: 16px; }
  .twoColItem { flex: 1; }
  .subHeading { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: #3D4F5C; }

  .noPrev { font-size: 11px; color: #7A909E; padding: 20px 0; }
`;

export async function exportAnalysisPdf(
  d: StaffDashboard,
): Promise<{ uri: string; filename: string }> {
  if (!d.meta || !d.subjects || !d.students) {
    throw new Error("Missing dashboard data required for the Analysis PDF export.");
  }
  const html = `
    <html>
      <head><meta charset="utf-8" /><style>${ANALYSIS_STYLES}</style></head>
      <body>${buildClassPerformanceHtml(d)}${buildMeritListHtml(d)}${buildDistributionHtml(d)}${buildComparisonHtml(d)}</body>
    </html>`;
  const filename = `Grade${d.grade}_${safeSlug(d.meta.examLabel)}_Term${d.meta.term}_${d.meta.year}_Analysis.pdf`;

  const webResult = await renderHtmlToPdfOrNull(html, filename);
  if (webResult) return webResult;

  const { uri: tempUri } = await Print.printToFileAsync({ html });
  const base64 = await FileSystem.readAsStringAsync(tempUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return saveBase64File(base64, filename, "application/pdf", "Save Analysis Report");
}