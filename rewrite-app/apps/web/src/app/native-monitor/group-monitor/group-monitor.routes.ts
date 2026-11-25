import type {Routes} from '@angular/router';

const groupMonitor=()=>import('./group-monitor.component').then(module=>module.GroupMonitorComponent);

export const groupMonitorRoutes:Routes=[
 {path:':group-name/:profile-id',loadComponent:groupMonitor},
 {path:':group-name',loadComponent:groupMonitor}
];
