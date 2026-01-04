import React, { useState, useEffect } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Button, { ButtonGroup } from '@atlaskit/button';
import { Checkbox } from '@atlaskit/checkbox';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import styled from 'styled-components';
import MenuIcon from '@atlaskit/icon/glyph/menu';

const ItemContainer = styled.div`
    display: flex;
    align-items: center;
    padding: 8px;
    background: #fff;
    border: 1px solid #dfe1e6;
    margin-bottom: 4px;
    border-radius: 3px;
    
    &:hover {
        background: #f4f5f7;
    }
`;

const DragHandle = styled.div`
    margin-right: 8px;
    cursor: grab;
    display: flex;
    align-items: center;
    color: #6B778C;
`;

// Helper to reorder
const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

const ColumnPicker = ({ isOpen, onClose, allColumns, activeColumnKeys, onSave }) => {
    // Local state for the list being edited
    // We combine allColumns with active state and order
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // reconstruct state from props
            // 1. Visible columns in their specific order
            const visible = activeColumnKeys.map(key => allColumns.find(c => c.id === key)).filter(Boolean);

            // 2. Hidden columns (append at the end? or keep them separately?)
            // Usually reorder list contains EVERYTHING, or just active ones? 
            // Better UX: Show ONE list of ALL columns.
            // Problem: If I hide a column, where does it go? changing order of hidden columns doesn't matter much.
            // Let's keep a single ordered list of ALL columns.
            // But `activeColumnKeys` is only the visible ones.
            // We need a "master order" too? Or just infer order from "Active List + Remaining Inactive List"?

            // Let's assume the user wants to reorder the *Visible* columns.
            // The unselected ones can stay at the bottom or top.
            // Complex.
            // Alternative: Two lists? "Visible" (sortable) and "Available" (click to add).
            // Request said "Checkbox list + drag handles". This implies a single list where you check/uncheck.
            // If I uncheck, does it stay in place? Yes.
            // So we need a persistent ORDER of ALL columns, and a boolean for Visibility.

            // However, Dashboard only tracks `activeColumnKeys` (which implies order AND visibility).
            // We need to verify if `allColumns` has a default order. 
            // We can construct the list as: [ ...activeColumnsOrdered, ...remainingColumns ]

            const activeSet = new Set(activeColumnKeys);
            const remaining = allColumns.filter(c => !activeSet.has(c.id));

            const merged = [
                ...activeColumnKeys.map(key => allColumns.find(c => c.id === key)).filter(Boolean),
                ...remaining
            ].map(col => ({
                ...col,
                isVisible: activeSet.has(col.id)
            }));

            setItems(merged);
        }
    }, [isOpen, allColumns, activeColumnKeys]);

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const newItems = reorder(
            items,
            result.source.index,
            result.destination.index
        );
        setItems(newItems);
    };

    const toggleItem = (id) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, isVisible: !item.isVisible } : item
        ));
    };

    const handleSave = () => {
        // Extract only visible items in their current order
        const newActiveKeys = items.filter(i => i.isVisible).map(i => i.id);
        onSave(newActiveKeys);
        onClose();
    };

    const handleReset = () => {
        // Reset to all columns visible in their original definition order
        const defaults = allColumns.map(col => ({
            ...col,
            isVisible: true
        }));
        setItems(defaults);
    };

    return (
        <ModalTransition>
            {isOpen && (
                <Modal onClose={onClose} width="medium">
                    <ModalHeader>
                        <ModalTitle>Customize Columns</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <p style={{ marginBottom: '16px' }}>
                            Drag to reorder. Uncheck to hide.
                        </p>
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="columns">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                    >
                                        {items.map((item, index) => (
                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided) => (
                                                    <ItemContainer
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                    >
                                                        <DragHandle {...provided.dragHandleProps}>
                                                            <MenuIcon label="Drag" size="small" />
                                                        </DragHandle>
                                                        <Checkbox
                                                            isChecked={item.isVisible}
                                                            onChange={() => toggleItem(item.id)}
                                                            label={item.label}
                                                        />
                                                    </ItemContainer>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </ModalBody>
                    <ModalFooter>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <Button appearance="subtle-link" onClick={handleReset}>Reset to Default</Button>
                            <ButtonGroup>
                                <Button appearance="subtle" onClick={onClose}>Cancel</Button>
                                <Button appearance="primary" onClick={handleSave}>Apply</Button>
                            </ButtonGroup>
                        </div>
                    </ModalFooter>
                </Modal>
            )}
        </ModalTransition>
    );
};

export default ColumnPicker;
