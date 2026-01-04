import React, { useState } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Button, { ButtonGroup } from '@atlaskit/button';
import Textfield from '@atlaskit/textfield';
import Select from '@atlaskit/select';
import Form, { Field, FormFooter, FormSection } from '@atlaskit/form';

const SaveReportModal = ({ isOpen, onClose, onSave, loading }) => {

    // Cleaned up unused local state

    const handleSubmit = (data) => {
        onSave({ name: data.name, visibility: data.visibility.value });
    };

    const visibilityOptions = [
        { label: 'Private (Just Me)', value: 'private' },
        { label: 'Project (Entire Project)', value: 'project' },
        { label: 'Global (Everyone)', value: 'global' }
    ];

    return (
        <ModalTransition>
            {isOpen && (
                <Modal onClose={onClose}>
                    <Form onSubmit={handleSubmit}>
                        {({ formProps, submitting }) => (
                            <form {...formProps}>
                                <ModalHeader>
                                    <ModalTitle>Save Report</ModalTitle>
                                </ModalHeader>
                                <ModalBody>
                                    <FormSection>
                                        <Field name="name" label="Report Name" defaultValue="" isRequired>
                                            {({ fieldProps }) => <Textfield {...fieldProps} placeholder="My Weekly Report" />}
                                        </Field>
                                        <Field name="visibility" label="Visibility" defaultValue={visibilityOptions[0]}>
                                            {({ fieldProps }) => (
                                                <Select
                                                    {...fieldProps}
                                                    options={visibilityOptions}
                                                    placeholder="Select visibility"
                                                    menuPosition="fixed" // Ensure menu doesn't get cut off
                                                />
                                            )}
                                        </Field>
                                    </FormSection>
                                </ModalBody>
                                <ModalFooter>
                                    <ButtonGroup>
                                        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
                                        <Button appearance="primary" type="submit" isLoading={loading}>Save</Button>
                                    </ButtonGroup>
                                </ModalFooter>
                            </form>
                        )}
                    </Form>
                </Modal>
            )}
        </ModalTransition>
    );
};

export default SaveReportModal;
