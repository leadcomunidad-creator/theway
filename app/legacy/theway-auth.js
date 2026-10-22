/* THE WAY — acceso con Google para abrir Mi Mapa. */
(function(){
  'use strict';
  var CONFIG={url:'https://dgllysqskzpjtmflfnew.supabase.co',publishableKey:'sb_publishable_In8S8O4wx4mPdR75-jrRSg_fu6MWbqv',redirectTo:'https://thewaylhscol.netlify.app/'};
  var client=null,user=null,resolveReady;
  var ready=new Promise(function(resolve){resolveReady=resolve});
  function notify(){window.dispatchEvent(new CustomEvent('theway-auth-change',{detail:api}))}
  function getClient(){
    if(client||!window.supabase)return client;
    client=window.supabase.createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  }
  async function refresh(){
    var db=getClient();
    if(!db){resolveReady(api);return}
    var result=await db.auth.getSession();
    user=result.data&&result.data.session?result.data.session.user:null;
    resolveReady(api);notify();
  }
  async function signInWithGoogle(){
    var db=getClient();
    if(!db)throw new Error('No fue posible iniciar el servicio de acceso.');
    var result=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:CONFIG.redirectTo}});
    if(result.error)throw result.error;
  }
  async function signOut(){
    var db=getClient();if(db)await db.auth.signOut();user=null;notify();
    if(window.parent&&window.parent!==window)window.parent.postMessage({type:'theway-signout'},window.location.origin);
  }
  var api=window.TheWayAuth={ready:ready,getUser:function(){return user},signInWithGoogle:signInWithGoogle,signOut:signOut};
  function start(){var db=getClient();if(!db){resolveReady(api);return}db.auth.onAuthStateChange(function(){setTimeout(refresh,0)});refresh()}
  if(window.supabase)start();else window.addEventListener('load',start,{once:true});
})();
