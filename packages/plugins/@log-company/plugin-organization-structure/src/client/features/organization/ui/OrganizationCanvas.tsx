/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Tooltip } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import { buildDepartmentTree, collectDepartmentIds, getAncestorIds } from '../utils/departmentTree';
import type {
  DepartmentTreeNode,
  FocusTarget,
  Identifier,
  OrganizationDepartment,
  OrganizationEmployee,
  OrganizationPermissions,
} from '../model/types';
import { DepartmentCard } from './DepartmentCard';
import { ZoomControls } from './ZoomControls';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;
const PAN_ACTIVATION_DISTANCE = 4;

interface OrganizationCanvasProps {
  departments: OrganizationDepartment[];
  permissions: OrganizationPermissions;
  selectedDepartmentId: Identifier | null;
  focusTarget: FocusTarget | null;
  onSelect: (departmentId: Identifier) => void;
  onCreateRoot: () => void;
  onCreateChild: (department: OrganizationDepartment) => void;
  onEdit: (department: OrganizationDepartment) => void;
  onMove: (department: OrganizationDepartment) => void;
  onDelete: (department: OrganizationDepartment) => void;
  onAssignManager: (department: OrganizationDepartment) => void;
  onAddEmployees: (department: OrganizationDepartment) => void;
  onShowMembers: (department: OrganizationDepartment) => void;
  onOpenEmployee: (employee: OrganizationEmployee) => void;
  onMoveEmployee: (employee: OrganizationEmployee) => void;
  onRemoveEmployee: (employee: OrganizationEmployee, department: OrganizationDepartment) => void;
  onTerminateEmployee: (employee: OrganizationEmployee) => void;
  onMakeManager: (employee: OrganizationEmployee, department: OrganizationDepartment) => void;
}

interface PanState {
  pointerId: number;
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
  captured: boolean;
}

export function OrganizationCanvas(props: OrganizationCanvasProps) {
  const { t } = useOrganizationTranslation();
  const tree = useMemo(() => buildDepartmentTree(props.departments), [props.departments]);
  const allDepartmentIds = useMemo(() => collectDepartmentIds(tree), [tree]);
  const [expandedIds, setExpandedIds] = useState<Set<Identifier>>(() => new Set(allDepartmentIds));
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<Identifier, HTMLDivElement>());
  const panState = useRef<PanState | null>(null);

  useEffect(() => {
    setExpandedIds((current) => new Set([...current, ...allDepartmentIds]));
  }, [allDepartmentIds]);

  const centerDepartment = useCallback((departmentId: Identifier) => {
    const canvas = canvasRef.current;
    const card = cardRefs.current.get(departmentId);
    if (!canvas || !card) {
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    canvas.scrollTo({
      left: canvas.scrollLeft + cardRect.left + cardRect.width / 2 - canvasRect.left - canvasRect.width / 2,
      top: canvas.scrollTop + cardRect.top + cardRect.height / 2 - canvasRect.top - canvasRect.height / 2,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (!props.focusTarget) {
      return;
    }
    const ancestors = getAncestorIds(props.departments, props.focusTarget.departmentId);
    setExpandedIds((current) => new Set([...current, ...ancestors, props.focusTarget?.departmentId || '']));
    const timer = window.setTimeout(() => centerDepartment(props.focusTarget?.departmentId || ''), 50);
    return () => window.clearTimeout(timer);
  }, [centerDepartment, props.departments, props.focusTarget]);

  const centerDiagram = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.scrollTo({ left: Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2), top: 0, behavior: 'smooth' });
  }, []);

  const renderNode = (node: DepartmentTreeNode): React.ReactNode => {
    const branchExpanded = expandedIds.has(node.id);
    return (
      <div className="lc-org-tree__group" key={node.id}>
        <DepartmentCard
          department={node}
          permissions={props.permissions}
          selected={props.selectedDepartmentId === node.id}
          highlightedEmployeeId={props.focusTarget?.departmentId === node.id ? props.focusTarget.employeeId : undefined}
          branchExpanded={branchExpanded}
          hasChildren={node.children.length > 0}
          setCardRef={(element) => {
            if (element) {
              cardRefs.current.set(node.id, element);
            } else {
              cardRefs.current.delete(node.id);
            }
          }}
          onSelect={() => props.onSelect(node.id)}
          onToggleBranch={() => {
            setExpandedIds((current) => {
              const next = new Set(current);
              if (next.has(node.id)) {
                next.delete(node.id);
              } else {
                next.add(node.id);
              }
              return next;
            });
          }}
          onCreateChild={() => props.onCreateChild(node)}
          onEdit={() => props.onEdit(node)}
          onMove={() => props.onMove(node)}
          onDelete={() => props.onDelete(node)}
          onAssignManager={() => props.onAssignManager(node)}
          onAddEmployees={() => props.onAddEmployees(node)}
          onShowMembers={() => props.onShowMembers(node)}
          onOpenEmployee={props.onOpenEmployee}
          onMoveEmployee={props.onMoveEmployee}
          onRemoveEmployee={(employee) => props.onRemoveEmployee(employee, node)}
          onTerminateEmployee={props.onTerminateEmployee}
          onMakeManager={(employee) => props.onMakeManager(employee, node)}
        />
        {branchExpanded && node.children.length > 0 ? (
          <div className="lc-org-tree__children">{node.children.map(renderNode)}</div>
        ) : null}
      </div>
    );
  };

  return (
    <main
      ref={canvasRef}
      className="lc-org-canvas"
      aria-label={t('canvas.diagram')}
      onPointerDown={(event) => {
        const target = event.target;
        if (
          event.button !== 0 ||
          !(target instanceof Node) ||
          !event.currentTarget.contains(target) ||
          (target instanceof Element && target.closest('[data-interactive="true"]'))
        ) {
          return;
        }
        panState.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          scrollLeft: event.currentTarget.scrollLeft,
          scrollTop: event.currentTarget.scrollTop,
          captured: false,
        };
      }}
      onPointerMove={(event) => {
        const pan = panState.current;
        if (!pan || pan.pointerId !== event.pointerId) {
          return;
        }
        const deltaX = event.clientX - pan.x;
        const deltaY = event.clientY - pan.y;
        if (!pan.captured) {
          if (Math.hypot(deltaX, deltaY) < PAN_ACTIVATION_DISTANCE) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          pan.captured = true;
        }
        event.currentTarget.scrollLeft = pan.scrollLeft - deltaX;
        event.currentTarget.scrollTop = pan.scrollTop - deltaY;
      }}
      onPointerUp={(event) => {
        const pan = panState.current;
        if (pan?.pointerId === event.pointerId) {
          panState.current = null;
          if (pan.captured) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }
      }}
      onPointerCancel={() => {
        panState.current = null;
      }}
    >
      <div className="lc-org-canvas__content" style={{ zoom }}>
        {props.permissions.canCreateDepartment(null) ? (
          <Tooltip title={t('departments.createRoot')}>
            <Button
              className="lc-org-add-root"
              shape="circle"
              icon={<PlusOutlined />}
              aria-label={t('departments.createRoot')}
              onClick={props.onCreateRoot}
              data-interactive="true"
            />
          </Tooltip>
        ) : null}
        {tree.length > 0 ? <div className="lc-org-tree lc-org-tree--roots">{tree.map(renderNode)}</div> : null}
      </div>
      {tree.length === 0 ? (
        <div className="lc-org-canvas__empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('departments.empty')} />
        </div>
      ) : null}
      <ZoomControls
        zoom={zoom}
        onZoomOut={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
        onZoomIn={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
        onReset={() => setZoom(1)}
        onCenter={centerDiagram}
      />
    </main>
  );
}
