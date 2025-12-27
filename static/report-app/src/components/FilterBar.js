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
    const [sprint, setSprint] = useState(null);
    const [assignee, setAssignee] = useState([]);
    const [status, setStatus] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [exceededOnly, setExceededOnly] = useState(false);

    const [projectOptions, setProjectOptions] = useState([]);
    const [assigneeOptions, setAssigneeOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);

    // Fetch options on mount
    useEffect(() => {
        invoke('getProjects').then(setProjectOptions).catch(console.error);
        invoke('getUsers', {}).then(setAssigneeOptions).catch(console.error);
        invoke('getStatuses').then(setStatusOptions).catch(console.error);
    }, []);

    const handleApply = () => {
        onFilterChange({
            project,
            sprint,
            assignee,
            status,
            startDate,
            endDate,
            exceededOnly
        });
    };

    const handleClear = () => {
        setProject([]);
        setAssignee([]);
        setStatus([]);
        setSprint(null);
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

            {/* Sprint is tricky without board context, leaving as textbox or future improvement. 
          For now removed or just kept as disabled select until implemented. 
          Actually, let's remove Sprint from initial scope or just keep mock.
      */}

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
                <Label>Status</Label>
                <Select
                    options={statusOptions}
                    isMulti
                    placeholder="Select Status"
                    onChange={setStatus}
                    value={status}
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
