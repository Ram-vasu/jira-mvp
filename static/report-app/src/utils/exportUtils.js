import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const prepareData = (rows, commentMode, selectedFields) => {
    const data = rows.map(row => {
        const fullData = {
            Key: row.key,
            Summary: row.summary,
            Assignee: row.assignee?.name || 'Unassigned',
            Status: row.status,
            TimeSpent: row.timeSpent,
            Estimate: row.estimate,
            Exceeded: row.exceeded ? 'Yes' : 'No',
            Comments: formatComments(row.comments, commentMode)
        };

        if (!selectedFields || selectedFields.length === 0) return fullData;

        const filteredData = {};
        selectedFields.forEach(field => {
            if (fullData.hasOwnProperty(field)) {
                filteredData[field] = fullData[field];
            }
        });
        return filteredData;
    });
    return data;
};

export const exportToCSV = (rows, commentMode, selectedFields) => {
    const data = prepareData(rows, commentMode, selectedFields);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "jira_report.csv");
};

export const exportToExcel = (rows, commentMode, selectedFields) => {
    const data = prepareData(rows, commentMode, selectedFields);
    const ws = XLSX.utils.json_to_sheet(data);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "jira_report.xlsx");
};

export const exportToPDF = (rows, commentMode, selectedFields) => {
    // Use landscape for better column fit
    const doc = new jsPDF({ orientation: 'landscape' });
    const data = prepareData(rows, commentMode, selectedFields);
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const commentsIndex = headers.indexOf('Comments');

    const columnStyles = {};
    if (commentsIndex !== -1) {
        // Set a fixed width for comments to force wrapping and prevent overflow
        // A4 Landscape width is ~297mm. 90mm is substantial but leaves room for other cols.
        columnStyles[commentsIndex] = { cellWidth: 90 };
    }

    doc.text("Developer Report", 14, 15);

    autoTable(doc, {
        head: [headers],
        body: data.map(obj => Object.values(obj)),
        startY: 20,
        styles: { fontSize: 8 },
        columnStyles: columnStyles,
        didParseCell: (dataCell) => {
            // Robustly find column header
            const index = dataCell.column.index;
            const headerName = headers[index];
            if (headerName === 'Exceeded' && dataCell.cell.raw === 'Yes') {
                dataCell.cell.styles.textColor = [255, 0, 0];
            }
        }
    });

    doc.save("jira_report.pdf");
};
