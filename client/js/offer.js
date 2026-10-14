'use strict';
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  async function boot(){
    const code = location.pathname.split('/').pop().toUpperCase();
    const zone=document.getElementById('offer-zone');
    if(!zone) return;
    try{
      const res=await fetch('/api/offer/'+encodeURIComponent(code),{credentials:'include'});
      if(!res.ok) throw new Error('العرض غير موجود');
      const data=await res.json();
      const offer=data.offer||{};
      const lead=data;
      zone.innerHTML =
        '<div class="offer-hero">' +
          (offer.logo? '<img src="'+esc(offer.logo)+'" alt="">':'') +
          '<h1 style="font-family:var(--font-display);margin:0 0 8px">'+esc(offer.headline||lead.restaurant_name)+'</h1>' +
          '<p style="opacity:.9">'+esc(offer.sub||'موقع طلب خاص + واتساب + حجز طاولات')+'</p>' +
          '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
            (offer.demoUrl? '<a class="btn" style="background:#fff;color:var(--ink)" href="'+esc(offer.demoUrl)+'" target="_blank" rel="noopener">فتح الديمو</a>':'') +
            '<a class="btn btn-outline" style="background:rgba(255,255,255,.12);color:#fff" href="/login.html" target="_blank" rel="noopener">دخول الإدارة</a>' +
          '</div></div>' +
        '<div class="offer-card"><h3>'+esc(lead.restaurant_name)+' — '+esc(lead.city||'')+'</h3>' +
          '<p class="small muted">'+esc(offer.sub||'')+'</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            (offer.demoUrl? '<a class="btn btn-sm" href="'+esc(offer.demoUrl)+'" target="_blank" rel="noopener">معاينة الديمو</a>':'') +
            '<a class="btn btn-outline btn-sm" href="https://wa.me/972567439846" target="_blank" rel="noopener">تواصل +972567439846</a>' +
          '</div>' +
          '<p class="small muted" style="margin-top:12px">7 أيام تجربة مجانية — '+esc(lead.score_level||'')+' '+esc(lead.score||'')+'/100</p></div>' +
        '<p class="small muted" style="text-align:center;margin-top:12px">هذا العرض تم إنشاؤه خصيصاً لـ '+esc(lead.restaurant_name)+' — Restivo</p>';
      const img = zone.querySelector('.offer-hero img');
      if(img) img.addEventListener('error', ()=>{ img.style.display='none'; }, {once:true});
    }catch(e){ zone.innerHTML='<p class="notice notice-error">'+esc(e.message)+'</p>'; }
  }
  boot();
})();
