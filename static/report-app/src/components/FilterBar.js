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

const FilterBar = ({ onFilterChange }) => {
    const [project, setProject] = useState([]);
    const [sprint, setSprint] = useState([]);
    const [assignee, setAssignee] = useState([]);
    const [status, setStatus] = useState([]);
    const [issueType, setIssueType] = useState([]);
    const [priority, setPriority] = useState([]);
    const [labels, setLabels] = useState([]);
    const [parent, setParent] = useState([]);

    // Sprint logic: Re-enable


    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [exceededOnly, setExceededOnly] = useState(false);

    const [projectOptions, setProjectOptions] = useState([]);
    const [assigneeOptions, setAssigneeOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [issueTypeOptions, setIssueTypeOptions] = useState([]);
    const [priorityOptions, setPriorityOptions] = useState([]);
    const [labelOptions, setLabelOptions] = useState([]);
    const [sprintOptions, setSprintOptions] = useState([]);
    const [parentOptions, setParentOptions] = useState([]);

    // Fetch options on mount
    // Fetch options on mount and when project changes
    useEffect(() => {
        // Always fetch projects initially if not loaded (though we usually just want one fetch)
        if (projectOptions.length === 0) {
            invoke('getProjects').then(setProjectOptions).catch(console.error);
        }

        const projectKeys = project.map(p => p.key);
        const payload = { projectKeys };

        invoke('getUsers', payload).then(setAssigneeOptions).catch(console.error);
        invoke('getStatuses').then(setStatusOptions).catch(console.error); // Statuses often global or complex to filter per project without knowing board
        invoke('getIssueTypes').then(setIssueTypeOptions).catch(console.error);
        invoke('getPriorities').then(setPriorityOptions).catch(console.error);
        invoke('getLabels').then(setLabelOptions).catch(console.error);

        // Context aware fetches
        invoke('getSprints', payload).then(setSprintOptions).catch(console.error);
        invoke('getParents', payload).then(setParentOptions).catch(console.error);

    }, [project]);

    const handleApply = () => {
        onFilterChange({
            project,
            sprint,
            assignee,
            status,
            issueType,
            priority,
            labels,
            parent,
            startDate,
            endDate,
            exceededOnly
        });
    };

    const handleClear = () => {
        setProject([]);
        setAssignee([]);
        setStatus([]);
        setIssueType([]);
        setPriority([]);
        setLabels([]);
        setSprint([]);
        setParent([]);

        setStartDate(null);
        setEndDate(null);
        setExceededOnly(false);
        onFilterChange({});
    };

    return (
        <Container>
            <FieldGroup>
                <Label>Project</Label>
                <Select
                    options={projectOptions}
                    placeholder="Select Projects"
                    onChange={(val) => setProject(val || [])}
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
                    onChange={(val) => setSprint(val || [])}
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
                    onChange={(val) => setParent(val || [])}
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
                    onChange={(val) => setAssignee(val || [])}
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
                    onChange={(val) => setIssueType(val || [])}
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
                    onChange={setStatus}
                    value={status}
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Priority</Label>
                <Select
                    options={priorityOptions}
                    isMulti
                    placeholder="Select Priority"
                    onChange={setPriority}
                    value={priority}
                />
            </FieldGroup>

            <FieldGroup>
                <Label>Labels</Label>
                <Select
                    options={labelOptions}
                    isMulti
                    placeholder="Select Labels"
                    onChange={setLabels}
                    value={labels}
                />
            </FieldGroup>

            <FieldGroup style={{ minWidth: '150px' }}>
                <Label>Start Date</Label>
                <DatePicker
                    onChange={setStartDate}
                    value={startDate}
                    locale="en-US"
                />
            </FieldGroup>

            <FieldGroup style={{ minWidth: '150px' }}>
                <Label>End Date</Label>
                <DatePicker
                    onChange={setEndDate}
                    value={endDate}
                    locale="en-US"
                />
            </FieldGroup>

            <div style={{ paddingBottom: '8px' }}>
                <Checkbox
                    label="Exceeded Estimates Only"
                    isChecked={exceededOnly}
                    onChange={(e) => setExceededOnly(e.target.checked)}
                />
            </div>

            <div style={{ paddingBottom: '2px', display: 'flex', gap: '8px' }}>
                <Button appearance="subtle" onClick={handleClear}>
                    Clear
                </Button>
                <Button appearance="primary" onClick={handleApply}>
                    Apply Filters
                </Button>
            </div>
        </Container>
    );
};

export default FilterBar;
