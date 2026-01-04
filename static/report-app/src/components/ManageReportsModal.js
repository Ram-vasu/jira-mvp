import React, { useState } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button';
import DynamicTable from '@atlaskit/dynamic-table';
import { invoke } from '@forge/bridge';

const ManageReportsModal = ({ isOpen, onClose, reports, onReportDeleted, currentUserAccountId, addFlag }) => {

    // State to track which report is being deleted (if any) to show confirmation
    const [reportToDelete, setReportToDelete] = useState(null);

    const confirmDelete = (report) => {
        setReportToDelete(report);
    };

    const cancelDelete = () => {
        setReportToDelete(null);
    };

    const executeDelete = async () => {
        if (!reportToDelete) return;

        try {
            await invoke('deleteReport', { reportId: reportToDelete.id });
            onReportDeleted(); // Update list and show success toast
        } catch (e) {
            console.error('Failed to delete report', e);
            if (addFlag) {
                addFlag({ title: 'Error', description: 'Failed to delete report: ' + e.message, appearance: 'error' });
            }
        } finally {
            setReportToDelete(null);
        }
    };

    const head = {
        cells: [
            { key: 'name', content: 'Name', isSortable: true },
            { key: 'visibility', content: 'Visibility', isSortable: true },
            { key: 'actions', content: '' }
        ]
    };

    const rows = reports.map(r => ({
        key: r.id,
        cells: [
            { key: 'name', content: r.name },
            { key: 'visibility', content: r.visibility === 'private' ? 'Private' : (r.visibility === 'project' ? 'Project' : 'Global') },
            {
                key: 'actions',
                content: (r.ownerAccountId === currentUserAccountId) ? (
                    <Button appearance="danger" onClick={() => confirmDelete(r)}>Delete</Button>
                ) : null
            }
        ]
    }));

    return (
        <>
            <ModalTransition>
                {isOpen && !reportToDelete && (
                    <Modal onClose={onClose} width="medium" key="manage-modal">
                        <ModalHeader>
                            <ModalTitle>Manage Saved Reports</ModalTitle>
                        </ModalHeader>
                        <ModalBody>
                            <div style={{ minHeight: '300px' }}>
                                <DynamicTable
                                    head={head}
                                    rows={rows}
                                    rowsPerPage={10}
                                    defaultPage={1}
                                    emptyView="No saved reports found."
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button onClick={onClose}>Close</Button>
                        </ModalFooter>
                    </Modal>
                )}
            </ModalTransition>

            <ModalTransition>
                {reportToDelete && (
                    <Modal onClose={cancelDelete} width="small" key="delete-confirm-modal">
                        <ModalHeader>
                            <ModalTitle appearance="danger">Delete Report?</ModalTitle>
                        </ModalHeader>
                        <ModalBody>
                            <p>Are you sure you want to delete the report <b>"{reportToDelete.name}"</b>?</p>
                            <p>This action cannot be undone.</p>
                        </ModalBody>
                        <ModalFooter>
                            <Button appearance="subtle" onClick={cancelDelete}>Cancel</Button>
                            <Button appearance="danger" onClick={executeDelete} autoFocus>Delete</Button>
                        </ModalFooter>
                    </Modal>
                )}
            </ModalTransition>
        </>
    );
};

export default ManageReportsModal;
