import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {bindNativeSmokeServerOwner} from './native-monitor-smoke-io.mjs';
const server=await createProductionApiServer(),sockets=new Set();let blocked=false,phase='online';
server.prependListener('upgrade',(request,socket)=>{
 process.send?.({nativeWsUpgrade:{phase,path:new URL(request.url,'http://owned.invalid').pathname}});
 if(blocked){socket.destroy();return;}sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
});
server.on('request',(request,response)=>{
 const path=new URL(request.url,'http://owned.invalid').pathname;
 if(request.method==='GET'&&(/^\/test\/[^/]+\/commands$/.test(path)||/^\/monitor\/group\/[^/]+\/test-sessions$/.test(path)))
  response.once('finish',()=>process.send?.({nativeWsPoll:{phase,path,status:response.statusCode}}));
});
process.on('message',message=>{
 if(message?.nativeWsControl){const control=message.nativeWsControl;blocked=control.blocked;phase=control.phase;const dropped=control.drop?sockets.size:0;if(control.drop)for(const socket of sockets)socket.destroy();process.send?.({nativeWsControlReady:phase,dropped});}
});
bindNativeSmokeServerOwner(server);server.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port}));
