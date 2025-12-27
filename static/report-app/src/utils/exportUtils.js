import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const formatComments = (comments, mode) => {
    if (!comments || comments.length === 0) return '';
    if (mode === 'none') return '';
    if (mode === 'last') {
        const last = comments[comments.length - 1];
        return `[${last.author.displayName}]: ${last.body?.content?.[0]?.content?.[0]?.text || 'Content'}`;
    }
    // Full
    return comments.map(c => `[${c.author.displayName}]: ${c.body?.content?.[0]?.content?.[0]?.text || 'Content'}`).join('\n');
};
// Note: Body parsing depends on Jira ADF structure. Above is simplified for standard paragraph/text.
// Robust parsing would be recursive but for demo this is fine.

const prepareData = (rows, commentMode) => {
    return rows.map(row => ({
        Key: row.key,
        Summary: row.summary,
        Assignee: row.assignee?.name || 'Unassigned',
        Status: row.status,
        TimeSpent: row.timeSpent,
        Estimate: row.estimate,
        Exceeded: row.exceeded ? 'Yes' : 'No',
        Comments: formatComments(row.comments, commentMode)
    }));
};

export const exportToCSV = (rows, commentMode) => {
    const data = prepareData(rows, commentMode);
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "jira_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportToExcel = (rows, commentMode) => {
    const data = prepareData(rows, commentMode);
    const ws = XLSX.utils.json_to_sheet(data);

    // Conditional Formatting logic would go here if using a pro library, 
    // but xlsx basic/community doesn't support writing styles easily without plugins (xlsx-style).
    // We will just dump data for now.

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "jira_report.xlsx");
};

export const exportToPDF = (rows, commentMode) => {
    const doc = new jsPDF();
    const data = prepareData(rows, commentMode);
    const columns = Object.keys(data[0]).map(key => ({ header: key, dataKey: key }));

    doc.text("Developer Report", 14, 15);

    doc.autoTable({
        head: [Object.keys(data[0])],
        body: data.map(obj => Object.values(obj)),
        startY: 20,
        styles: { fontSize: 8 },
        columnStyles: {
            7: { cellWidth: 50 } // Comments column wider
        },
        didParseCell: (data) => {
            if (data.column.index === 6 && data.cell.raw === 'Yes') { // Exceeded column
                data.cell.styles.textColor = [255, 0, 0];
            }
        }
    });

    doc.save("jira_report.pdf");
};
