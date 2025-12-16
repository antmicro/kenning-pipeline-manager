/*
 * Copyright (c) 2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useViewModel, useGraph } from '@baklavajs/renderer-vue';
import NotificationHandler from '../core/notifications.js';

import notifyEvents from './notifyEvents.js';

export const exposedInterfaceNotification = (intf, graphId, exposed) => {
    const { viewModel } = useViewModel();

    const type = typeof intf.type === 'string' ? 'Property' : 'Interface';

    const msg = exposed ? 'exposed' : 'privatized';

    if (viewModel.value.editor.getGraphNode(graphId)) {
        NotificationHandler.terminalLog('warning', 'Upper graph updated', `${type} ${intf.name} has been ${msg} from subgraph.`);
    }
};

export const nodeWithExposedInterfaceNotification = (node) => {
    const { viewModel } = useViewModel();

    const { graph } = useGraph();

    const grapNode = viewModel.value.editor.getGraphNode(graph.value.id);

    // node is part of subgrap node
    if (grapNode) {
        const exposedInterfaces = [...Object.values(node.inputs), ...Object.values(node.outputs)]
            .filter((intf) => intf.externalName);

        exposedInterfaces.forEach((intf) => {
            const intfType = typeof intf.type !== 'string' ? 'interface' : 'property';

            NotificationHandler.terminalLog('info', 'Upper graph updated', `Exposed ${intfType} ${intf.externalName} has been removed.`);
        });
    }
};

const initNotificationEvents = () => {
    notifyEvents.exposedInterface.subscribe('notify', (values) => {
        exposedInterfaceNotification(...values);
    });

    notifyEvents.removedNode.subscribe('notify', (node) => {
        nodeWithExposedInterfaceNotification(node);
    });
};

export default initNotificationEvents;
