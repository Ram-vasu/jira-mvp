import React, { useState, useEffect } from 'react';
import Modal, { ModalTransition, ModalHeader, ModalBody, ModalFooter, ModalTitle } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button';
import Select from '@atlaskit/select';
import { invoke } from '@forge/bridge';
import styled from 'styled-components';

const TextArea = styled.textarea`
    width: 100%;
    min-height: 100px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
    resize: vertical;
`;

const BulkCommentModal = ({ isOpen, onClose, selectedIssues, onComplete }) => {
    const [comment, setComment] = useState('');
    const [mentions, setMentions] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [userOptions, setUserOptions] = useState([]);

    useEffect(() => {
        if (isOpen) {
            invoke('getUsers', {}).then(setUserOptions).catch(console.error);
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await invoke('bulkAddComment', { issueKeys: selectedIssues, comment, mentions });
            onComplete();
            onClose();
        } catch (error) {
            console.error('Failed to add comments', error);
            // TODO: Handle error
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalTransition>
            {isOpen && (
                <Modal onClose={onClose}>
                    <ModalHeader>
                        <ModalTitle>Add Comment to {selectedIssues.length} Issues</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <p style={{ marginBottom: '10px' }}>Enter the comment to add to all selected issues:</p>
                        <div style={{ marginBottom: '10px' }}>
                            <Select
                                isMulti
                                options={userOptions}
                                placeholder="Select users to mention..."
                                onChange={setMentions}
                                value={mentions}
                                menuPortalTarget={document.body}
                                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                            />
                        </div>
                        <TextArea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Type your comment here..."
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button appearance="subtle" onClick={onClose} isDisabled={submitting}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} isLoading={submitting} isDisabled={submitting || !comment.trim()}>Add Comment</Button>
                    </ModalFooter>
                </Modal>
            )}
        </ModalTransition>
    );
};

export default BulkCommentModal;
