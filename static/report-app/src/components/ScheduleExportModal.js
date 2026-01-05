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

const ScheduleExportModal = ({ isOpen, onClose, filters, addFlag }) => {
    const [format, setFormat] = useState('excel');
    const [commentMode, setCommentMode] = useState('last');
    const [frequency, setFrequency] = useState('daily');
    const [weekDay, setWeekDay] = useState('1'); // Monday
    const [monthDate, setMonthDate] = useState('1'); // 1st
    const [time, setTime] = useState('09:00');

    // Destination Config
    const [destination, setDestination] = useState('issue'); // 'issue' (create new), 'comment' (existing)
    const [targetIssueKey, setTargetIssueKey] = useState('');
    const [message, setMessage] = useState('Your scheduled report is ready! Please find the attached file.');

    const [email, setEmail] = useState('');
    const [accountId, setAccountId] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const [selectedFields, setSelectedFields] = useState(OPTIONS);

    useEffect(() => {
        if (isOpen) {
            // Fetch current user email as default
            invoke('getCurrentUser').then(user => {
                if (user) {
                    if (user.email) {
                        setEmail(user.email);
                        setCurrentUserEmail(user.email);
                    }
                    if (user.accountId) {
                        setAccountId(user.accountId);
                    }
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

    const notify = (msg, type = 'error') => {
        if (addFlag) {
            addFlag({ title: type === 'error' ? 'Error' : 'Success', description: msg, appearance: type });
        } else {
            alert(msg);
        }
    };

    const handleSchedule = async (shouldClose = true) => {
        setLoading(true);
        try {
            if (destination === 'comment' && !targetIssueKey) {
                notify('Please provide a Target Issue Key for the comment destination.', 'error');
                setLoading(false);
                return false;
            }

            const finalAccountId = (email === currentUserEmail) ? accountId : null;

            const scheduleData = {
                format,
                commentMode,
                frequency,
                weekDay: parseInt(weekDay),
                monthDate: parseInt(monthDate),
                time,
                destination,
                targetIssueKey,
                message,
                email,
                accountId: finalAccountId,
                filters,
                selectedFields,
                active: true,
                createdAt: new Date().toISOString()
            };

            await invoke('saveSchedule', scheduleData);

            if (shouldClose) {
                onClose();
                notify('Schedule saved successfully.', 'success');
            }
            return true;
        } catch (error) {
            console.error('Failed to schedule export:', error);
            notify('Failed to save schedule.', 'error');
            return false;
        } finally {
            if (shouldClose) setLoading(false);
        }
    };

    const handleTestNow = async () => {
        if (!email) {
            notify('Email required for test', 'error');
            return;
        }
        setLoading(true);
        // Save first just in case
        const saved = await handleSchedule(false);
        if (!saved) {
            setLoading(false);
            return;
        }

        try {
            const resp = await invoke('triggerSchedule', { email });
            console.log('Test result:', resp);
            if (resp && resp.message) {
                notify(resp.message, resp.success ? 'success' : 'error');
            }
        } catch (e) {
            console.error('Test trigger failed:', e);
            notify('Test failed. Check console for details.', 'error');
        } finally {
            setLoading(false);
            // Don't close automatically so user can see result, or close? User asked to "Save & check". 
            // Usually we close if successful.
            onClose();
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
                            <Label>Frequency</Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ flex: 1 }}>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </Select>

                                {frequency === 'weekly' && (
                                    <Select value={weekDay} onChange={(e) => setWeekDay(e.target.value)} style={{ flex: 1 }}>
                                        <option value="1">Monday</option>
                                        <option value="2">Tuesday</option>
                                        <option value="3">Wednesday</option>
                                        <option value="4">Thursday</option>
                                        <option value="5">Friday</option>
                                        <option value="6">Saturday</option>
                                        <option value="0">Sunday</option>
                                    </Select>
                                )}

                                {frequency === 'monthly' && (
                                    <Select value={monthDate} onChange={(e) => setMonthDate(e.target.value)} style={{ flex: 1 }}>
                                        {[...Array(28).keys()].map(d => (
                                            <option key={d + 1} value={d + 1}>{d + 1}{d + 1 === 1 ? 'st' : d + 1 === 2 ? 'nd' : d + 1 === 3 ? 'rd' : 'th'}</option>
                                        ))}
                                    </Select>
                                )}
                            </div>
                        </Field>

                        <Field>
                            <Label>Time (UTC)</Label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                                <div style={{ fontSize: '0.85em', color: '#666', whiteSpace: 'nowrap' }}>
                                    Current UTC: {new Date().toISOString().slice(11, 16)}
                                </div>
                            </div>
                        </Field>

                        <Field>
                            <Label>Destination</Label>
                            <Select value={destination} onChange={(e) => setDestination(e.target.value)}>
                                <option value="issue">Create New Issue (Task)</option>
                                <option value="comment">Comment on Existing Issue</option>
                                <option value="email">Email Notification (via Jira)</option>
                            </Select>
                        </Field>

                        {destination === 'comment' && (
                            <Field>
                                <Label>Target Issue Key</Label>
                                <Input
                                    value={targetIssueKey}
                                    onChange={(e) => setTargetIssueKey(e.target.value)}
                                    placeholder="e.g. PROJ-123"
                                />
                                <HelperText>The Excel report will be attached to this issue.</HelperText>
                            </Field>
                        )}

                        <Field>
                            <Label>Message / Description</Label>
                            <textarea
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '4px', borderColor: '#ccc',
                                    minHeight: '60px', fontFamily: 'inherit'
                                }}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter custom message..."
                            />
                        </Field>

                        <Field>
                            <Label>Recipient (for assignment/notify)</Label>
                            <Input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                            />
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
