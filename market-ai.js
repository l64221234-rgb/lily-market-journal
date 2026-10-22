/* Lily Market Journal — optional AI receipt review extension */
(()=>{
'use strict';
const API='https://lily-market-ai.l64221234.workers.dev/analyze';
const $=id=>document.getElementById(id);
const css=document.createElement('style');css.textContent=`#aiReview{width:min(94vw,820px);max-height:90vh;overflow:auto;border:1px solid #dfd0bd;background:#faf5ec;color:#40372f;padding:22px}#aiReview::backdrop{background:#0008}#aiReview .airow{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;margin:9px 0}#aiReview input{min-width:0}#aiReview .aihead{font-size:12px;color:#77665a}#aiReview .aiitem{border-top:1px solid #dfd0bd;padding:10px 0}#aiReview .aiitem label{margin:4px 0}#aiReview .aiitem input[type=checkbox]{width:auto}#aiReview .aistatus{color:#965c40;font-size:13px;white-space:pre-wrap}@media(max-width:620px){#aiReview .airow{grid-template-columns:1fr 1fr}#aiReview{padding:12px}}`;document.head.append(css);
const dlg=document.createElement('dialog');dlg.id='aiReview';dlg.innerHTML=`<h2>AI 收據辨識・人工核對</h2><p class="tiny">AI 可能看錯；請依原始收據逐筆核對。未勾選的項目不會儲存。</p><div id="aiReceiptMeta"></div><div id="aiRows"></div><p class="aistatus" id="aiReviewStatus"></p><div class="actions"><button class="btn red" id="aiSave">儲存已勾選商品</button><button class="btn secondary" id="aiClose">關閉</button></div>`;document.body.append(dlg);
$('aiClose').onclick=()=>dlg.close();let active=null;
function el(tag,attrs={},text){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,v)}if(text!==undefined)n.textContent=String(text);return n}
function field(parent,label,value,type='text'){const wrap=el('label');wrap.append(el('span',{},label));const input=el('input',{type});input.value=value==null?'':String(value);wrap.append(input);parent.append(wrap);return input}
async function analyzeReceipt(r,btn){if(!client||!user){alert('請先登入 GitHub');return}btn.disabled=true;btn.textContent='AI 辨識中…';try{
 const {data:{session},error:se}=await client.auth.getSession();if(se||!session?.access_token)throw Error('登入已過期，請重新登入');
 const signed=await client.storage.from('market-receipts').createSignedUrl(r.storage_path,120);if(signed.error)throw signed.error;
 const photo=await fetch(signed.data.signedUrl);if(!photo.ok)throw Error('收據照片讀取失敗');const blob=await photo.blob();if(blob.size>9_000_000)throw Error('圖片太大，請先縮小照片');
 const b64=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(',')[1]);rd.onerror=()=>reject(Error('無法讀取照片'));rd.readAsDataURL(blob)});
 const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({image:b64,mime:blob.type||'image/jpeg'})});let result=await resp.json();if(!resp.ok)throw Error(result.detail||result.error||'AI 服務錯誤');
 const raw=result.items||[];if(!Array.isArray(raw)||!raw.length)throw Error('AI 沒有辨識出商品，請使用手動補一筆');active={r,result};$('aiRows').replaceChildren();$('aiReviewStatus').textContent='';
 const meta=el('div',{class:'airow'});const store=field(meta,'店家',result.store||'');const date=field(meta,'購買日期',result.date||'','date');$('aiReceiptMeta').replaceChildren(meta);active.store=store;active.date=date;active.rows=[];
 for(const item of raw){const wrap=el('div',{class:'aiitem'});const check=el('input',{type:'checkbox'});check.checked=true;const label=el('label');label.append(check,document.createTextNode(' 確認儲存此商品'));wrap.append(label);const grid=el('div',{class:'airow'});
 const name=field(grid,'商品名稱',item.name||item.product_name||'');const spec=field(grid,'規格',item.spec||item.size||'');const qty=field(grid,'數量',item.qty??item.quantity??1,'number');const amount=field(grid,'單價 NT$',item.amount??item.unit_price??item.price??'','number');wrap.append(grid);$('aiRows').append(wrap);active.rows.push({check,name,spec,qty,amount});}
 dlg.showModal();
 }catch(e){alert('AI 辨識失敗：'+(e.message||String(e)))}finally{btn.disabled=false;btn.textContent='AI 辨識收據'}}
$('aiSave').onclick=async()=>{if(!active||!client||!user)return;const btn=$('aiSave');const {store,date,rows}=active;const records=[];for(const x of rows.filter(x=>x.check.checked)){
 const q=Number(x.qty.value),a=Number(x.amount.value);if(!x.name.value.trim()||!Number.isInteger(q)||q<1||x.amount.value===''||!Number.isFinite(a)||a<0||!store.value.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(date.value)){alert('請補齊店家、日期、商品名稱、數量及單價');return}
 records.push({user_id:user.id,name:x.name.value.trim(),date:date.value,store:store.value.trim(),category:'其他',spec:x.spec.value.trim(),barcode:'',amount:a,qty:q});}
 if(!records.length){alert('請至少勾選一筆商品');return}if(!confirm('確定儲存 '+records.length+' 筆已人工核對的商品？'))return;
 btn.disabled=true;$('aiReviewStatus').textContent='正在儲存…';try{const {error}=await client.from('market_items').insert(records);if(error)throw error;$('aiReviewStatus').textContent='已儲存 '+records.length+' 筆商品。';dlg.close();if(typeof sync==='function')await sync();alert('商品已儲存到 Supabase；收據仍保留在待整理清單，請確認完整後再標記已核對。');}catch(e){$('aiReviewStatus').textContent='儲存失敗：'+(e.message||String(e))}finally{btn.disabled=false;}};
// Add buttons after the existing receipt list is rendered, without replacing existing code.
const root=$('receiptList');if(!root)return;let busy=false;const observer=new MutationObserver(()=>{if(busy)return;busy=true;try{const cards=[...root.querySelectorAll('.receipt-card')];const receipts=receiptRecords||[];cards.forEach((card,i)=>{if(card.querySelector('.aiAnalyze'))return;const r=receipts[i];if(!r)return;const actions=card.querySelector('.actions');if(!actions)return;const btn=el('button',{class:'btn red aiAnalyze',type:'button'},'AI 辨識收據');btn.onclick=()=>analyzeReceipt(r,btn);actions.prepend(btn)})}finally{busy=false}});observer.observe(root,{childList:true,subtree:true});
})();
