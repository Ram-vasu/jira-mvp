import React, { useState } from 'react';
import Modal, { ModalTransition, ModalHeader, ModalBody, ModalFooter, ModalTitle } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button';

import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

// I didn't install @atlaskit/radio. I will use standard inputs for speed.
import styled from 'styled-components';

const Field = styled.div`
    margin-bottom: 16px;
`;
const Label = styled.div`
    font-weight: 600;
    margin-bottom: 8px;
`;

const ExportModal = ({ isOpen, onClose, rows }) => {
    const [format, setFormat] = useState('excel');
    const [commentMode, setCommentMode] = useState('last');

    const handleExport = () => {
        if (format === 'csv') exportToCSV(rows, commentMode);
        if (format === 'excel') exportToExcel(rows, commentMode);
        if (format === 'pdf') exportToPDF(rows, commentMode);
        onClose();
    };

    return (
        <ModalTransition>
            {isOpen && (
                <Modal onClose={onClose}>
                    <ModalHeader>
                        <ModalTitle>Export Report</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <Field>
                            <Label>Format</Label>
                            <div>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={format === 'excel'} onChange={() => setFormat('excel')} /> Excel
                                </label>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV
                                </label>
                                <label>
                                    <input type="radio" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> PDF
                                </label>
                            </div>
                        </Field>
                        <Field>
                            <Label>Comments</Label>
                            <div>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={commentMode === 'none'} onChange={() => setCommentMode('none')} /> None
                                </label>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={commentMode === 'last'} onChange={() => setCommentMode('last')} /> Last Comment
                                </label>
                                <label>
                                    <input type="radio" checked={commentMode === 'full'} onChange={() => setCommentMode('full')} /> Full History
                                </label>
                            </div>
                        </Field>
                    </ModalBody>
                    <ModalFooter>
                        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
                        <Button appearance="primary" onClick={handleExport}>Download</Button>
                    </ModalFooter>
                </Modal>
            )}
        </ModalTransition>
    );
};

export default ExportModal;
