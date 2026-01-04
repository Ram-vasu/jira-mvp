import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Select from '@atlaskit/select';
import { DatePicker } from '@atlaskit/datetime-picker';
import { Checkbox } from '@atlaskit/checkbox';
import Button from '@atlaskit/button';
import { invoke } from '@forge/bridge';

const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  padding: 16px;
  background-color: #f4f5f7;
  border-radius: 4px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 200px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #6B778C;
`;

const FilterBar = ({ filterState, onFilterChange, onApply }) => {
    // Destructure values from parent state, defaulting to empty/null
    const {
        project = [],
        sprint = [],
        assignee = [],
        status = [],
        issueType = [],
        priority = [],
        labels = [],
        parent = [],
        startDate = null,
        endDate = null,
        exceededOnly = false
    } = filterState;

    // Helper to update a specific field in parent state
    const handleChange = (field, value) => {
        onFilterChange({
            ...filterState,
            [field]: value
        });
    };

    const handleClear = () => {
        const resetState = {
            project: [],
            sprint: [],
            assignee: [],
            status: [],
            issueType: [],
            priority: [],
            labels: [],
            parent: [],
            startDate: null,
            endDate: null,
            exceededOnly: false
        };
        onFilterChange(resetState);
        // Trigger fetch immediately with reset state
        // We pass the resetState to onApply so the parent knows what to use immediately
        // instead of waiting for state update.
        if (onApply) onApply(resetState);
    };

    // --- Options State (Internal) ---
    const [projectOptions, setProjectOptions] = useState([]);
    const [assigneeOptions, setAssigneeOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [issueTypeOptions, setIssueTypeOptions] = useState([]);
    const [priorityOptions, setPriorityOptions] = useState([]);
    const [labelOptions, setLabelOptions] = useState([]);
    const [sprintOptions, setSprintOptions] = useState([]);
    const [parentOptions, setParentOptions] = useState([]);

    // Fetch static options on mount
    useEffect(() => {
        const fetchStatic = async () => {
            try {
                if (projectOptions.length === 0) {
                    await invoke('getProjects').then(setProjectOptions);
                }
                await Promise.all([
                    invoke('getStatuses').then(setStatusOptions),
                    invoke('getIssueTypes').then(setIssueTypeOptions)
                ]);
                await Promise.all([
                    invoke('getPriorities').then(setPriorityOptions),
                    invoke('getLabels').then(setLabelOptions)
                ]);
            } catch (e) {
                console.error("Error fetching static options", e);
            }
        };
        fetchStatic();
    }, []);

    // Fetch context-aware options when project changes
    // We strictly depend on the project IDs/Keys preventing unnecessary runs if reference changes but content doesn't
    const projectKeysHash = (project || []).map(p => p.value).join(',');

    useEffect(() => {
        const fetchContextData = async () => {
            const projectKeys = (project || []).map(p => p.key || p.value); // Handle both formats if necessary
            // If no projects selected, maybe clear options or fetch global? 
            // For now, let's assume we fetch generic or empty. 
            // Previous logic just passed empty list which is fine.
            const payload = { projectKeys };

            try {
                // Throttle this? For now, stable dependency should fix the loop.
                await invoke('getUsers', payload).then(setAssigneeOptions);
                await invoke('getSprints', payload).then(setSprintOptions);
                await invoke('getParents', payload).then(setParentOptions);
            } catch (e) {
                console.error("Error fetching context options", e);
            }
        };
        fetchContextData();
    }, [projectKeysHash]);

    return (
        <Container>
            <FieldGroup>
                <Label>Project</Label>
                <Select
                    options={projectOptions}
                    placeholder="Select Projects"
                    onChange={(val) => handleChange('project', val || [])}
                    value={project}
                    isMulti
                    isClearable
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Sprint</Label>
                <Select
                    options={sprintOptions}
                    placeholder="Select Sprint"
                    onChange={(val) => handleChange('sprint', val || [])}
                    value={sprint}
                    isMulti
                    isClearable
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Parent (Epic)</Label>
                <Select
                    options={parentOptions}
                    placeholder="Select Parent"
                    onChange={(val) => handleChange('parent', val || [])}
                    value={parent}
                    isMulti
                    isClearable
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Assignee</Label>
                <Select
                    options={assigneeOptions}
                    placeholder="Select Assignees"
                    onChange={(val) => handleChange('assignee', val || [])}
                    value={assignee}
                    isMulti
                    isClearable
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Work type</Label>
                <Select
                    options={issueTypeOptions}
                    placeholder="Select Work Type"
                    onChange={(val) => handleChange('issueType', val || [])}
                    value={issueType}
                    isMulti
                    isClearable
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Status</Label>
                <Select
                    options={statusOptions}
                    isMulti
                    placeholder="Select Status"
                    onChange={(val) => handleChange('status', val || [])}
                    value={status}
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Priority</Label>
                <Select
                    options={priorityOptions}
                    isMulti
                    placeholder="Select Priority"
                    onChange={(val) => handleChange('priority', val || [])}
                    value={priority}
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Labels</Label>
                <Select
                    options={labelOptions}
                    isMulti
                    placeholder="Select Labels"
                    onChange={(val) => handleChange('labels', val || [])}
                    value={labels}
                />
            </FieldGroup>

            <FieldGroup style={{ minWidth: '150px' }}>
                <Label>Start Date</Label>
                <DatePicker
                    onChange={(val) => handleChange('startDate', val)}
                    value={startDate}
                    locale="en-US"
                />
            </FieldGroup>

            <FieldGroup style={{ minWidth: '150px' }}>
                <Label>End Date</Label>
                <DatePicker
                    onChange={(val) => handleChange('endDate', val)}
                    value={endDate}
                    locale="en-US"
                />
            </FieldGroup>

            <div style={{ paddingBottom: '8px' }}>
                <Checkbox
                    label="Exceeded Estimates Only"
                    isChecked={exceededOnly}
                    onChange={(e) => handleChange('exceededOnly', e.target.checked)}
                />
            </div>

            <div style={{ paddingBottom: '2px', display: 'flex', gap: '8px' }}>
                <Button appearance="subtle" onClick={handleClear}>
                    Clear
                </Button>
                <Button appearance="primary" onClick={onApply}>
                    Apply Filters
                </Button>
            </div>
        </Container>
    );
};

export default FilterBar;
