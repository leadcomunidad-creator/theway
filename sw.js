self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil((async function(){var k=await caches.keys();await Promise.all(k.map(function(x){return caches.delete(x)}));await self.registration.unregister();var c=await self.clients.matchAll({type:'window'});c.forEach(function(w){w.navigate(w.url)});})());});
