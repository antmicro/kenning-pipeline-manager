"use strict";(self.webpackChunkpipeline_manager=self.webpackChunkpipeline_manager||[]).push([[171],{46171:(t,e,n)=>{n.d(e,{hZ:()=>a,Ng:()=>o,pB:()=>r,KE:()=>g,cO:()=>l,TS:()=>p,b1:()=>f,bP:()=>d,gZ:()=>c,$G:()=>m,EA:()=>u,A9:()=>v});var s=n(42302),i=n(34250);class o{constructor(t,e){if(this.destructed=!1,this.events={destruct:new i.Hx(this)},!t||!e)throw new Error("Cannot initialize connection with null/undefined for 'from' or 'to' values");this.id=(0,s.A)(),this.from=t,this.to=e,this.from.connectionCount++,this.to.connectionCount++}destruct(){this.events.destruct.emit(),this.from.connectionCount--,this.to.connectionCount--,this.destructed=!0}}class r{constructor(t,e){if(!t||!e)throw new Error("Cannot initialize connection with null/undefined for 'from' or 'to' values");this.id=(0,s.A)(),this.from=t,this.to=e}}function h(t,e){return Object.fromEntries(Object.entries(t).map((([t,n])=>[t,e(n)])))}class a{constructor(){this.id=(0,s.A)(),this.events={loaded:new i.Hx(this),beforeAddInput:new i.Bi(this),addInput:new i.Hx(this),beforeRemoveInput:new i.Bi(this),removeInput:new i.Hx(this),beforeAddOutput:new i.Bi(this),addOutput:new i.Hx(this),beforeRemoveOutput:new i.Bi(this),removeOutput:new i.Hx(this),update:new i.Hx(this)},this.hooks={beforeLoad:new i.vz(this),afterSave:new i.vz(this)}}get graph(){return this.graphInstance}addInput(t,e){return this.addInterface("input",t,e)}addOutput(t,e){return this.addInterface("output",t,e)}removeInput(t){return this.removeInterface("input",t)}removeOutput(t){return this.removeInterface("output",t)}registerGraph(t){this.graphInstance=t}load(t){this.hooks.beforeLoad.execute(t),this.id=t.id,this.title=t.title,Object.entries(t.inputs).forEach((([t,e])=>{this.inputs[t]&&(this.inputs[t].load(e),this.inputs[t].nodeId=this.id)})),Object.entries(t.outputs).forEach((([t,e])=>{this.outputs[t]&&(this.outputs[t].load(e),this.outputs[t].nodeId=this.id)})),this.events.loaded.emit(this)}save(){const t=h(this.inputs,(t=>t.save())),e=h(this.outputs,(t=>t.save())),n={type:this.type,id:this.id,title:this.title,inputs:t,outputs:e};return this.hooks.afterSave.execute(n)}onPlaced(){}onDestroy(){}initializeIo(){Object.entries(this.inputs).forEach((([t,e])=>this.initializeIntf("input",t,e))),Object.entries(this.outputs).forEach((([t,e])=>this.initializeIntf("output",t,e)))}initializeIntf(t,e,n){n.isInput="input"===t,n.nodeId=this.id,n.events.setValue.subscribe(this,(()=>this.events.update.emit({type:t,name:e,intf:n})))}addInterface(t,e,n){const s="input"===t?this.events.beforeAddInput:this.events.beforeAddOutput,i="input"===t?this.events.addInput:this.events.addOutput,o="input"===t?this.inputs:this.outputs;return!s.emit(n).prevented&&(o[e]=n,this.initializeIntf(t,e,n),i.emit(n),!0)}removeInterface(t,e){const n="input"===t?this.events.beforeRemoveInput:this.events.beforeRemoveOutput,s="input"===t?this.events.removeInput:this.events.removeOutput,i="input"===t?this.inputs[e]:this.outputs[e];if(!i||n.emit(i).prevented)return!1;if(i.connectionCount>0){if(!this.graphInstance)throw new Error("Interface is connected, but no graph instance is specified. Unable to delete interface");this.graphInstance.connections.filter((t=>t.from===i||t.to===i)).forEach((t=>{this.graphInstance.removeConnection(t)}))}return i.events.setValue.unsubscribe(this),"input"===t?delete this.inputs[e]:delete this.outputs[e],s.emit(i),!0}}class d extends a{load(t){super.load(t)}save(){return super.save()}}function u(t){return class extends d{constructor(){var e,n;super(),this.type=t.type,this.title=null!==(e=t.title)&&void 0!==e?e:t.type,this.inputs={},this.outputs={},this.calculate=t.calculate?(e,n)=>t.calculate.call(this,e,n):void 0,this.executeFactory("input",t.inputs),this.executeFactory("output",t.outputs),null===(n=t.onCreate)||void 0===n||n.call(this)}onPlaced(){var e;null===(e=t.onPlaced)||void 0===e||e.call(this)}onDestroy(){var e;null===(e=t.onDestroy)||void 0===e||e.call(this)}executeFactory(t,e){Object.keys(e||{}).forEach((n=>{const s=e[n]();"input"===t?this.addInput(n,s):this.addOutput(n,s)}))}}}class p{get nodes(){return this._nodes}get connections(){return this._connections}get loading(){return this._loading}get destroying(){return this._destroying}constructor(t,e){this.id=(0,s.A)(),this.inputs=[],this.outputs=[],this.activeTransactions=0,this._nodes=[],this._connections=[],this._loading=!1,this._destroying=!1,this.events={beforeAddNode:new i.Bi(this),addNode:new i.Hx(this),beforeRemoveNode:new i.Bi(this),removeNode:new i.Hx(this),beforeAddConnection:new i.Bi(this),addConnection:new i.Hx(this),checkConnection:new i.Bi(this),beforeRemoveConnection:new i.Bi(this),removeConnection:new i.Hx(this)},this.hooks={save:new i.vz(this),load:new i.vz(this),checkConnection:new i.dM(this)},this.nodeEvents=(0,i.tz)(),this.nodeHooks=(0,i.tz)(),this.connectionEvents=(0,i.tz)(),this.editor=t,this.template=e,t.registerGraph(this)}addNode(t){if(!this.events.beforeAddNode.emit(t).prevented)return this.nodeEvents.addTarget(t.events),this.nodeHooks.addTarget(t.hooks),t.registerGraph(this),this._nodes.push(t),(t=this.nodes.find((e=>e.id===t.id))).onPlaced(),this.events.addNode.emit(t),t}removeNode(t){if(this.nodes.includes(t)){if(this.events.beforeRemoveNode.emit(t).prevented)return;const e=[...Object.values(t.inputs),...Object.values(t.outputs)];this.connections.filter((t=>e.includes(t.from)||e.includes(t.to))).forEach((t=>this.removeConnection(t))),this._nodes.splice(this.nodes.indexOf(t),1),this.events.removeNode.emit(t),t.onDestroy(),this.nodeEvents.removeTarget(t.events),this.nodeHooks.removeTarget(t.hooks)}}addConnection(t,e){const n=this.checkConnection(t,e);if(!n.connectionAllowed)return;if(this.events.beforeAddConnection.emit({from:t,to:e}).prevented)return;for(const t of n.connectionsInDanger){const e=this.connections.find((e=>e.id===t.id));e&&this.removeConnection(e)}const s=new o(n.dummyConnection.from,n.dummyConnection.to);return this.internalAddConnection(s),s}removeConnection(t){if(this.connections.includes(t)){if(this.events.beforeRemoveConnection.emit(t).prevented)return;t.destruct(),this._connections.splice(this.connections.indexOf(t),1),this.events.removeConnection.emit(t),this.connectionEvents.removeTarget(t.events)}}checkConnection(t,e){if(!t||!e)return{connectionAllowed:!1};const n=this.findNodeById(t.nodeId),s=this.findNodeById(e.nodeId);if(n&&s&&n===s)return{connectionAllowed:!1};if(t.isInput&&!e.isInput){const n=t;t=e,e=n}if(t.isInput||!e.isInput)return{connectionAllowed:!1};if(this.connections.some((n=>n.from===t&&n.to===e)))return{connectionAllowed:!1};if(this.events.checkConnection.emit({from:t,to:e}).prevented)return{connectionAllowed:!1};const i=this.hooks.checkConnection.execute({from:t,to:e});if(i.some((t=>!t.connectionAllowed)))return{connectionAllowed:!1};const o=Array.from(new Set(i.flatMap((t=>t.connectionsInDanger))));return{connectionAllowed:!0,dummyConnection:new r(t,e),connectionsInDanger:o}}findNodeInterface(t){for(const e of this.nodes){for(const n in e.inputs){const s=e.inputs[n];if(s.id===t)return s}for(const n in e.outputs){const s=e.outputs[n];if(s.id===t)return s}}}findNodeById(t){return this.nodes.find((e=>e.id===t))}load(t){try{this._loading=!0;const e=[];for(let t=this.connections.length-1;t>=0;t--)this.removeConnection(this.connections[t]);for(let t=this.nodes.length-1;t>=0;t--)this.removeNode(this.nodes[t]);this.id=t.id,this.inputs=t.inputs,this.outputs=t.outputs;for(const n of t.nodes){const t=this.editor.nodeTypes.get(n.type);if(!t){e.push(`Node type ${n.type} is not registered`);continue}const s=new t.type;this.addNode(s),s.load(n)}for(const n of t.connections){const t=this.findNodeInterface(n.from),s=this.findNodeInterface(n.to);if(t)if(s){const e=new o(t,s);e.id=n.id,this.internalAddConnection(e)}else e.push(`Could not find interface with id ${n.to}`);else e.push(`Could not find interface with id ${n.from}`)}return this.hooks.load.execute(t),e}finally{this._loading=!1}}save(){const t={id:this.id,nodes:this.nodes.map((t=>t.save())),connections:this.connections.map((t=>({id:t.id,from:t.from.id,to:t.to.id}))),inputs:this.inputs,outputs:this.outputs};return this.hooks.save.execute(t)}destroy(){this._destroying=!0;for(const t of this.nodes)this.removeNode(t);this.editor.unregisterGraph(this)}internalAddConnection(t){this.connectionEvents.addTarget(t.events),this._connections.push(t),this.events.addConnection.emit(t)}}class c{set connectionCount(t){this._connectionCount=t,this.events.setConnectionCount.emit(t)}get connectionCount(){return this._connectionCount}set value(t){this.events.beforeSetValue.emit(t).prevented||(this._value=t,this.events.setValue.emit(t))}get value(){return this._value}constructor(t,e){this.id=(0,s.A)(),this.nodeId="",this.port=!0,this.hidden=!1,this.events={setConnectionCount:new i.Hx(this),beforeSetValue:new i.Bi(this),setValue:new i.Hx(this),updated:new i.Hx(this)},this.hooks={load:new i.vz(this),save:new i.vz(this)},this._connectionCount=0,this.name=t,this._value=e}load(t){this.id=t.id,this.templateId=t.templateId,this.value=t.value,this.hooks.load.execute(t)}save(){const t={id:this.id,templateId:this.templateId,value:this.value};return this.hooks.save.execute(t)}setComponent(t){return this.component=t,this}setPort(t){return this.port=t,this}setHidden(t){return this.hidden=t,this}use(t,...e){return t(this,...e),this}}const l="__baklava_GraphNode-";function v(t){return l+t.id}function m(t){return class extends a{constructor(){super(...arguments),this.type=v(t),this._title="GraphNode",this.inputs={},this.outputs={},this.template=t,this.calculate=async(t,e)=>{if(!this.subgraph)throw new Error(`GraphNode ${this.id}: calculate called without subgraph being initialized`);if("object"==typeof e.engine&&e.engine&&"function"==typeof e.engine.runGraph){const n=new Map;for(const t of this.subgraph.nodes)Object.values(t.inputs).forEach((t=>{0===t.connectionCount&&n.set(t.id,t.value)}));Object.entries(t).forEach((([t,e])=>{const s=this.subgraph.inputs.find((e=>e.id===t));n.set(s.nodeInterfaceId,e)}));const s=await e.engine.runGraph(this.subgraph,n,e.globalValues),i=new Map;s.forEach(((t,e)=>{const n=this.subgraph.nodes.find((t=>t.id===e));t.forEach(((t,e)=>{i.set(n.outputs[e].id,t)}))}));const o={};return this.subgraph.outputs.forEach((t=>{o[t.id]=i.get(t.nodeInterfaceId)})),o._calculationResults=s,o}}}get title(){return this._title}set title(t){this.template.name=t}load(t){if(!this.subgraph)throw new Error("Cannot load a graph node without a graph");if(!this.template)throw new Error("Unable to load graph node without graph template");this.subgraph.load(t.graphState),super.load(t)}save(){if(!this.subgraph)throw new Error("Cannot save a graph node without a graph");return{...super.save(),graphState:this.subgraph.save()}}onPlaced(){this.template.events.updated.subscribe(this,(()=>this.initialize())),this.template.events.nameChanged.subscribe(this,(t=>{this._title=t})),this.initialize()}onDestroy(){var t;this.template.events.updated.unsubscribe(this),this.template.events.nameChanged.unsubscribe(this),null===(t=this.subgraph)||void 0===t||t.destroy()}initialize(){this.subgraph&&this.subgraph.destroy(),this.subgraph=this.template.createGraph(),this._title=this.template.name,this.updateInterfaces(),this.events.update.emit(null)}updateInterfaces(){if(!this.subgraph)throw new Error("Trying to update interfaces without graph instance");for(const t of this.subgraph.inputs)t.id in this.inputs?this.inputs[t.id].name=t.name:this.addInput(t.id,new c(t.name,void 0));for(const t of Object.keys(this.inputs))this.subgraph.inputs.some((e=>e.id===t))||this.removeInput(t);for(const t of this.subgraph.outputs)t.id in this.outputs?this.outputs[t.id].name=t.name:this.addOutput(t.id,new c(t.name,void 0));for(const t of Object.keys(this.outputs))this.subgraph.outputs.some((e=>e.id===t))||this.removeOutput(t);this.addOutput("_calculationResults",new c("_calculationResults",void 0).setHidden(!0))}}}class f{static fromGraph(t,e){return new f(t.save(),e)}get name(){return this._name}set name(t){this._name=t,this.events.nameChanged.emit(t);const e=this.editor.nodeTypes.get(v(this));e&&(e.title=t)}constructor(t,e){this.id=(0,s.A)(),this._name="Subgraph",this.events={nameChanged:new i.Hx(this),updated:new i.Hx(this)},this.hooks={beforeLoad:new i.vz(this),afterSave:new i.vz(this)},this.editor=e,t.id&&(this.id=t.id),t.name&&(this._name=t.name),this.update(t)}update(t){this.nodes=t.nodes,this.connections=t.connections,this.inputs=t.inputs,this.outputs=t.outputs,this.events.updated.emit()}save(){return{id:this.id,name:this.name,nodes:this.nodes,connections:this.connections,inputs:this.inputs,outputs:this.outputs}}createGraph(t){const e=new Map,n=t=>{const n=(0,s.A)();return e.set(t,n),n},i=t=>{const n=e.get(t);if(!n)throw new Error(`Unable to create graph from template: Could not map old id ${t} to new id`);return n},o=t=>h(t,(t=>({id:n(t.id),templateId:t.id,value:t.value}))),r=this.nodes.map((t=>({...t,id:n(t.id),inputs:o(t.inputs),outputs:o(t.outputs)}))),a=this.connections.map((t=>({id:n(t.id),from:i(t.from),to:i(t.to)}))),d=this.inputs.map((t=>({id:t.id,name:t.name,nodeInterfaceId:i(t.nodeInterfaceId)}))),u=this.outputs.map((t=>({id:t.id,name:t.name,nodeInterfaceId:i(t.nodeInterfaceId)}))),c={id:(0,s.A)(),nodes:r,connections:a,inputs:d,outputs:u};return t||(t=new p(this.editor)),t.load(c),t.template=this,t}}class g{constructor(){this.events={loaded:new i.Hx(this),beforeRegisterNodeType:new i.Bi(this),registerNodeType:new i.Hx(this),beforeUnregisterNodeType:new i.Bi(this),unregisterNodeType:new i.Hx(this),beforeAddGraphTemplate:new i.Bi(this),addGraphTemplate:new i.Hx(this),beforeRemoveGraphTemplate:new i.Bi(this),removeGraphTemplate:new i.Hx(this),registerGraph:new i.Hx(this),unregisterGraph:new i.Hx(this)},this.hooks={save:new i.vz(this),load:new i.vz(this)},this.graphTemplateEvents=(0,i.tz)(),this.graphTemplateHooks=(0,i.tz)(),this.graphEvents=(0,i.tz)(),this.graphHooks=(0,i.tz)(),this.nodeEvents=(0,i.tz)(),this.nodeHooks=(0,i.tz)(),this.connectionEvents=(0,i.tz)(),this._graphs=new Set,this._nodeTypes=new Map,this._graph=new p(this),this._graphTemplates=[],this._loading=!1}get nodeTypes(){return this._nodeTypes}get graph(){return this._graph}get graphTemplates(){return this._graphTemplates}get graphs(){return this._graphs}get loading(){return this._loading}registerNodeType(t,e){var n,s;if(this.events.beforeRegisterNodeType.emit({type:t,options:e}).prevented)return;const i=new t;this._nodeTypes.set(i.type,{type:t,category:null!==(n=null==e?void 0:e.category)&&void 0!==n?n:"default",title:null!==(s=null==e?void 0:e.title)&&void 0!==s?s:i.title}),this.events.registerNodeType.emit({type:t,options:e})}unregisterNodeType(t){const e="string"==typeof t?t:(new t).type;if(this.nodeTypes.has(e)){if(this.events.beforeUnregisterNodeType.emit(e).prevented)return;this._nodeTypes.delete(e),this.events.unregisterNodeType.emit(e)}}addGraphTemplate(t){if(this.events.beforeAddGraphTemplate.emit(t).prevented)return;this._graphTemplates.push(t),this.graphTemplateEvents.addTarget(t.events),this.graphTemplateHooks.addTarget(t.hooks);const e=m(t);this.registerNodeType(e,{category:"Subgraphs",title:t.name}),this.events.addGraphTemplate.emit(t)}removeGraphTemplate(t){if(this.graphTemplates.includes(t)){if(this.events.beforeRemoveGraphTemplate.emit(t).prevented)return;const e=v(t);for(const t of[this.graph,...this.graphs.values()]){const n=t.nodes.filter((t=>t.type===e));for(const e of n)t.removeNode(e)}this.unregisterNodeType(e),this._graphTemplates.splice(this._graphTemplates.indexOf(t),1),this.graphTemplateEvents.removeTarget(t.events),this.graphTemplateHooks.removeTarget(t.hooks),this.events.removeGraphTemplate.emit(t)}}registerGraph(t){this.graphEvents.addTarget(t.events),this.graphHooks.addTarget(t.hooks),this.nodeEvents.addTarget(t.nodeEvents),this.nodeHooks.addTarget(t.nodeHooks),this.connectionEvents.addTarget(t.connectionEvents),this.events.registerGraph.emit(t),this._graphs.add(t)}unregisterGraph(t){this.graphEvents.removeTarget(t.events),this.graphHooks.removeTarget(t.hooks),this.nodeEvents.removeTarget(t.nodeEvents),this.nodeHooks.removeTarget(t.nodeHooks),this.connectionEvents.removeTarget(t.connectionEvents),this.events.unregisterGraph.emit(t),this._graphs.delete(t)}load(t){try{this._loading=!0,(t=this.hooks.load.execute(t)).graphTemplates.forEach((t=>{const e=new f(t,this);this.addGraphTemplate(e)}));const e=this._graph.load(t.graph);return this.events.loaded.emit(),e.forEach((t=>console.warn(t))),e}finally{this._loading=!1}}save(){const t={graph:this.graph.save(),graphTemplates:this.graphTemplates.map((t=>t.save()))};return this.hooks.save.execute(t)}}}}]);
//# sourceMappingURL=171.4a53cec5.js.map