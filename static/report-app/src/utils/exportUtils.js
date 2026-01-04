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

const formatDuration = (seconds) => {
    if (!seconds) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
};

const prepareData = (rows, commentMode, selectedFields) => {
    return rows.map(row => {
        const fullData = {
            Key: row.key,
            Summary: row.summary,
            Assignee: row.assignee?.name || 'Unassigned',
            Status: row.status,
            TimeSpent: row.timeSpent || '0h',
            Estimate: row.estimate || '0h',
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
};

export const exportToCSV = (rows, commentMode, selectedFields) => {
    const data = prepareData(rows, commentMode, selectedFields);
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    // Manual download for CSV to ensure correct MIME
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "jira_report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportToExcel = (rows, commentMode, selectedFields) => {
    const data = prepareData(rows, commentMode, selectedFields);
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    const wscols = Object.keys(data[0] || {}).map(key => {
        if (key === 'Summary') return { wch: 40 };
        if (key === 'Comments') return { wch: 50 };
        return { wch: 15 };
    });
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "jira_report.xlsx");
};

export const exportToPDF = (rows, commentMode, selectedFields) => {
    // Landscape for more data
    const doc = new jsPDF({ orientation: 'landscape' });

    // --- Summary Section ---
    const totalIssues = rows.length;
    const totalTime = rows.reduce((acc, r) => acc + (r.timeSpentSeconds || 0), 0);
    const totalEst = rows.reduce((acc, r) => acc + (r.estimateSeconds || 0), 0);
    const statusCounts = rows.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    doc.setFontSize(18);
    doc.text("Project Developer Report", 14, 15);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    doc.text(`Total Issues: ${totalIssues}`, 14, 27);
    doc.text(`Total Time Spent: ${formatDuration(totalTime)}`, 60, 27);
    doc.text(`Total Estimate: ${formatDuration(totalEst)}`, 120, 27);

    // --- Simple Status Chart (Bar) ---
    let startX = 14;
    const startY = 35;
    const barHeight = 8;
    const totalWidth = 260; // Max width on landscape A4

    // Check if we have data for chart
    if (totalIssues > 0) {
        doc.setFontSize(8);
        doc.text("Status Breakdown:", 14, startY - 2);

        // Colors for statuses
        const colors = [
            [54, 179, 126],  // Green
            [0, 82, 204],    // Blue
            [255, 171, 0],   // Yellow
            [255, 86, 48],   // Red
            [101, 84, 192],  // Purple
            [9, 30, 66]      // Dark Blue
        ];

        let colorIdx = 0;
        let currentX = startX;

        Object.keys(statusCounts).forEach(status => {
            const count = statusCounts[status];
            const width = (count / totalIssues) * totalWidth;
            const color = colors[colorIdx % colors.length];

            doc.setFillColor(...color);
            doc.rect(currentX, startY, width, barHeight, 'F');

            // Legend below
            if (width > 5) { // Only label if space permits directly (simplified)
                // or just list standard legend
            }
            currentX += width;
            colorIdx++;
        });

        // Legend Text
        colorIdx = 0;
        let legendX = 14;
        let legendY = startY + barHeight + 5;
        Object.keys(statusCounts).forEach(status => {
            const color = colors[colorIdx % colors.length];
            doc.setFillColor(...color);
            doc.rect(legendX, legendY, 3, 3, 'F');
            doc.text(`${status} (${statusCounts[status]})`, legendX + 5, legendY + 2.5);
            legendX += 40;
            if (legendX > 270) {
                legendX = 14;
                legendY += 5;
            }
            colorIdx++;
        });
    }

    // --- Table Data ---
    const data = prepareData(rows, commentMode, selectedFields);
    if (data.length === 0) {
        doc.save("jira_report.pdf");
        return;
    }

    const headers = Object.keys(data[0]);
    const commentsIndex = headers.indexOf('Comments');

    const columnStyles = {};
    if (commentsIndex !== -1) {
        columnStyles[commentsIndex] = { cellWidth: 80 }; // Adjusted for landscape
    }

    // AutoTable starts after chart
    const tableStartY = totalIssues > 0 ? 55 : 35; // Adjust based on chart height

    autoTable(doc, {
        head: [headers],
        body: data.map(obj => Object.values(obj)),
        startY: tableStartY,
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fillColor: [9, 30, 66] },
        alternateRowStyles: { fillColor: [244, 245, 247] },
        columnStyles: columnStyles,
        didParseCell: (dataCell) => {
            const index = dataCell.column.index;
            const headerName = headers[index];
            if (headerName === 'Exceeded' && dataCell.cell.raw === 'Yes') {
                dataCell.cell.styles.textColor = [255, 0, 0];
                dataCell.cell.styles.fontStyle = 'bold';
            }
        }
    });

    doc.save("jira_report.pdf");
};
