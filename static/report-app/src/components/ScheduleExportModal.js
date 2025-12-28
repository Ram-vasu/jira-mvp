import React, { useState, useEffect } from 'react';
import Modal, { ModalTransition, ModalHeader, ModalBody, ModalFooter, ModalTitle } from '@atlaskit/modal-dialog';
import Button, { ButtonGroup } from '@atlaskit/button';
import { invoke, requestJira } from '@forge/bridge';
import styled from 'styled-components';

const Field = styled.div`
    margin-bottom: 16px;
`;
const Label = styled.div`
    font-weight: 600;
    margin-bottom: 8px;
`;
const Input = styled.input`
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box;
`;
const Select = styled.select`
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    width: 100%;
`;
const HelperText = styled.div`
    font-size: 0.85em;
    color: #6b778c;
    margin-top: 4px;
`;

const OPTIONS = ['Key', 'Summary', 'Assignee', 'Status', 'TimeSpent', 'Estimate', 'Exceeded', 'Comments'];

const ScheduleExportModal = ({ isOpen, onClose, currentFilters }) => {
    const [format, setFormat] = useState('excel');
    const [commentMode, setCommentMode] = useState('last');
    const [frequency, setFrequency] = useState('daily');
    const [time, setTime] = useState('09:00');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const [selectedFields, setSelectedFields] = useState(OPTIONS);

    useEffect(() => {
        if (isOpen) {
            // Fetch current user email as default
            invoke('getCurrentUserEmail').then(email => {
                if (email) {
                    setEmail(email);
                    setCurrentUserEmail(email);
                }
            }).catch(console.error);
        }
    }, [isOpen]);

    const toggleField = (field) => {
        if (selectedFields.includes(field)) {
            setSelectedFields(selectedFields.filter(f => f !== field));
        } else {
            setSelectedFields([...selectedFields, field]);
        }
    };

    const handleSchedule = async (shouldClose = true) => {
        setLoading(true);
        try {
            const scheduleData = {
                format,
                commentMode,
                frequency,
                time,
                email,
                filters: currentFilters,
                selectedFields,
                active: true,
                createdAt: new Date().toISOString()
            };

            await invoke('saveSchedule', scheduleData);

            // Show success flag/message? For now just close
            if (shouldClose) onClose();
        } catch (error) {
            console.error('Failed to schedule export:', error);
        } finally {
            if (shouldClose) setLoading(false);
        }
    };

    const handleTestNow = async () => {
        if (!email) {
            console.error('Email required for test');
            return;
        }
        setLoading(true);
        // Save first just in case, but don't close yet
        await handleSchedule(false);

        try {
            const resp = await invoke('triggerSchedule', { email });
            console.log('Test result:', resp);
            if (resp && resp.message) {
                alert(resp.message); // Simple alert for MVP feedback
            }
        } catch (e) {
            console.error('Test trigger failed:', e);
            alert('Test failed. Check console.');
        } finally {
            setLoading(false);
            onClose(); // Close after test
        }
    }

    return (
        <ModalTransition>
            {isOpen && (
                <Modal onClose={onClose}>
                    <ModalHeader>
                        <ModalTitle>Schedule Report Export</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <Field>
                            <Label>Export Format</Label>
                            <div>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={format === 'excel'} onChange={() => setFormat('excel')} /> Excel
                                </label>
                                <label>
                                    <input type="radio" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> PDF
                                </label>
                            </div>
                        </Field>

                        <Field>
                            <Label>Columns</Label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {OPTIONS.map(opt => (
                                    <label key={opt} style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFields.includes(opt)}
                                            onChange={() => toggleField(opt)}
                                            style={{ marginRight: 8 }}
                                        />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                        </Field>

                        <Field>
                            <Label>Comments Detail (if included)</Label>
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

                        <Field>
                            <Label>Frequency</Label>
                            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly (Monday)</option>
                                <option value="monthly">Monthly (1st of month)</option>
                            </Select>
                        </Field>

                        <Field>
                            <Label>Time (UTC)</Label>
                            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                        </Field>

                        <Field>
                            <Label>Email Recipient</Label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                            />
                            <HelperText>Report will be sent to this email address.</HelperText>
                        </Field>

                    </ModalBody>
                    <ModalFooter>
                        <Button appearance="subtle" onClick={onClose} isDisabled={loading}>Cancel</Button>
                        <Button onClick={handleTestNow} isDisabled={loading}>Save & Send Test Report</Button>
                        <Button appearance="primary" onClick={handleSchedule} isLoading={loading}>Schedule</Button>
                    </ModalFooter>
                </Modal>
            )}
        </ModalTransition>
    );
};

export default ScheduleExportModal;
