
/* Lily Market Journal — AI receipt review with persistent per-line progress */
(()=>{
'use strict';
const API='https://lily-market-ai.l64221234.workers.dev/analyze';
const $=id=>document.getElementById(id);
const css=document.createElement('style');css.textContent=`#aiReview{width:min(96vw,850px);max-height:92vh;overflow:auto;border:1px solid #dfd0bd;background:#faf5ec;color:#40372f;padding:20px}#aiReview::backdrop{background:#0008}#aiReview .airow{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;margin:8px 0}#aiReview .aiitem{border-top:1px solid #dfd0bd;padding:12px 0}#aiReview .aiitem input{min-width:0}#aiReview .aiitem label{margin:4px 0}#aiReview .aiitem input[type=checkbox]{width:auto}#aiReview .aistatus{color:#965c40;font-size:13px;white-space:pre-wrap}#aiReview .aibadge{font-size:12px;color:#785b43}#aiReview .aiitem[data-status=imported]{opacity:.65}#aiReview .aiitem[data-status=imported] input{background:#eee}#aiReview .aiitem .actions button{padding:7px 9px;font-size:12px}@media(max-width:620px){#aiReview .airow{grid-template-columns:1fr 1fr}#aiReview{padding:12px}}`;document.head.append(css);
const dlg=document.createElement('dialog');dlg.id='aiReview';dlg.innerHTML=`<h2>AI 收據辨識・逐項核對</h2><p class="tiny">可先匯入部分商品，其餘保留待處理；「略過」不會匯入商品。AI 漏掉的品項可手動新增。</p><div id="aiReceiptMeta"></div><p id="aiProgress"></p><div id="aiRows"></div><p class="aistatus" id="aiReviewStatus"></p><div class="actions"><button class="btn secondary" id="aiAdd">＋ 補登一項</button><button class="btn secondary" id="aiDraft">儲存修改</button><button class="btn red" id="aiSave">匯入勾選商品</button><button class="btn secondary" id="aiClose">關閉</button></div>`;document.body.append(dlg);
let active=null, saving=false;
function el(tag,attrs={},text){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,v)}if(text!==undefined)n.textContent=String(text);return n}
function field(parent,label,value,type='text'){const wrap=el('label');wrap.append(el('span',{},label));const input=el('input',{type});input.value=value==null?'':String(value);wrap.append(input);parent.append(wrap);return input}
function errorOf(r){if(r.error)throw r.error;return r.data}
function progress(lines){const imported=lines.filter(x=>x.status==='imported').length,skipped=lines.filter(x=>x.status==='skipped').length,pending=lines.length-imported-skipped;return {imported,skipped,pending,total:lines.length}}
async function loadLines(receiptId){return errorOf(await client.from('market_receipt_lines').select('*').eq('receipt_id',receiptId).order('line_no'))||[]}
function receiptMeta(r){return {store:r.store||'',date:r.purchase_date||''}}
function paint(){if(!active)return;const {lines}=active;$('aiRows').replaceChildren();active.rows=[];
 for(const line of lines){const wrap=el('div',{class:'aiitem'});wrap.dataset.status=line.status;const label=el('div',{class:'aibadge'},`第 ${line.line_no} 項 · ${line.status==='imported'?'已匯入':line.status==='skipped'?'已略過':'待處理'}`);wrap.append(label);const grid=el('div',{class:'airow'});const name=field(grid,'商品名稱',line.name);const spec=field(grid,'規格',line.spec);const qty=field(grid,'數量',line.qty,'number');const amount=field(grid,'單價 NT$',line.amount,'number');wrap.append(grid);
 const actions=el('div',{class:'actions'});const check=el('input',{type:'checkbox'});check.checked=false;const checkLabel=el('label');checkLabel.append(check,document.createTextNode(' 選擇匯入'));if(line.status==='pending')actions.append(checkLabel);
 if(line.status!=='imported'){const skip=el('button',{class:'btn secondary',type:'button'},line.status==='skipped'?'恢復待處理':'略過此項');skip.onclick=()=>{line.status=line.status==='skipped'?'pending':'skipped';line._dirty=true;paint()};actions.append(skip)}
 if(line.status==='imported'){for(const input of [name,spec,qty,amount])input.disabled=true}
 wrap.append(actions);$('aiRows').append(wrap);active.rows.push({line,check,name,spec,qty,amount});}
 const p=progress(lines);$('aiProgress').textContent=`已匯入 ${p.imported} / ${p.total} 項｜待處理 ${p.pending} 項｜已略過 ${p.skipped} 項`;
 $('aiSave').disabled=p.pending===0;
}
function capture(){if(!active)return;for(const x of active.rows){if(x.line.status==='imported')continue;x.line.name=x.name.value.trim();x.line.spec=x.spec.value.trim();x.line.qty=Number(x.qty.value);x.line.amount=x.amount.value===''?null:Number(x.amount.value);x.line._selected=x.check.checked}}
function validate(x,forImport){if(!Number.isInteger(x.qty)||x.qty<1)throw Error(`第 ${x.line_no} 項數量必須是正整數`);if(x.amount!==null&&(!Number.isFinite(x.amount)||x.amount<0))throw Error(`第 ${x.line_no} 項價格有誤`);if(forImport&&(!x.name||x.amount===null))throw Error(`第 ${x.line_no} 項缺少商品名稱或價格`)}
async function saveDraft(){if(!active)return;capture();const a=active;for(const line of a.lines){if(line.status==='imported')continue;validate(line,false);const patch={name:line.name,spec:line.spec,qty:line.qty,amount:line.amount??0,store:a.store.value.trim(),purchase_date:a.date.value||null,status:line.status};errorOf(await client.from('market_receipt_lines').update(patch).eq('id',line.id).eq('user_id',user.id));}await refreshCardProgress(a.r.id);}
async function openReceipt(r){if(!client||!user){alert('請先登入 GitHub');return}try{const lines=await loadLines(r.id);if(!lines.length){alert('尚無辨識紀錄，請先點「AI 辨識收據」。');return}active={r,lines};const meta=el('div',{class:'airow'});const m=receiptMeta(lines[0]);active.store=field(meta,'店家',m.store);active.date=field(meta,'購買日期',m.date,'date');$('aiReceiptMeta').replaceChildren(meta);$('aiReviewStatus').textContent='';paint();dlg.showModal()}catch(e){alert('讀取待處理清單失敗：'+e.message+'。請先確認已執行資料庫更新 SQL。')}}
async function analyzeReceipt(r,btn){if(!client||!user){alert('請先登入 GitHub');return}btn.disabled=true;btn.textContent='AI 辨識中…';try{
 const existing=await loadLines(r.id);if(existing.length){if(!confirm('這張收據已有儲存的辨識清單。重新辨識可能改變待處理內容；已匯入商品會保留。要重新辨識嗎？')){await openReceipt(r);return}if(existing.some(x=>x.status==='imported'))throw Error('已有商品匯入，為避免重複與錯位，請使用「繼續核對」及「補登一項」，不要重新辨識');}
 const {data:{session},error:se}=await client.auth.getSession();if(se||!session?.access_token)throw Error('登入已過期，請重新登入');
 const signed=await client.storage.from('market-receipts').createSignedUrl(r.storage_path,120);if(signed.error)throw signed.error;
 const photo=await fetch(signed.data.signedUrl);if(!photo.ok)throw Error('收據照片讀取失敗');const blob=await photo.blob();if(blob.size>9_000_000)throw Error('圖片太大，請先縮小照片');
 const b64=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(',')[1]);rd.onerror=()=>reject(Error('無法讀取照片'));rd.readAsDataURL(blob)});
 const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({image:b64,mime:blob.type||'image/jpeg'})});const result=await resp.json();if(!resp.ok)throw Error(result.detail||result.error||'AI 服務錯誤');
 const raw=result.items||[];if(!Array.isArray(raw)||!raw.length)throw Error('AI 沒有辨識出商品，可使用原本的「依收據新增商品」手動補登');
 const records=raw.map((item,i)=>({user_id:user.id,receipt_id:r.id,line_no:i+1,name:String(item.name||item.product_name||''),spec:String(item.spec||item.size||''),qty:Math.max(1,Math.round(Number(item.qty??item.quantity??1)||1)),amount:Number(item.amount??item.unit_price??item.price??0)||0,store:String(result.store||''),purchase_date:/^\d{4}-\d{2}-\d{2}$/.test(result.date||'')?result.date:null,status:'pending'}));
 if(existing.length){errorOf(await client.from('market_receipt_lines').delete().eq('receipt_id',r.id).eq('user_id',user.id));}
 errorOf(await client.from('market_receipt_lines').insert(records));await openReceipt(r);await refreshCardProgress(r.id);
 }catch(e){alert('AI 辨識失敗：'+(e.message||String(e)))}finally{btn.disabled=false;btn.textContent='AI 辨識收據'}}
$('aiAdd').onclick=async()=>{if(!active||saving)return;try{capture();const a=active;const next=Math.max(0,...a.lines.map(x=>x.line_no))+1;const record={user_id:user.id,receipt_id:a.r.id,line_no:next,name:'',spec:'',qty:1,amount:0,store:a.store.value.trim(),purchase_date:a.date.value||null,status:'pending'};const created=errorOf(await client.from('market_receipt_lines').insert(record).select('*').single());a.lines.push(created);paint();$('aiReviewStatus').textContent=`已新增第 ${next} 項，請填寫並儲存修改。`;await refreshCardProgress(a.r.id)}catch(e){$('aiReviewStatus').textContent='新增失敗：'+e.message}};
$('aiDraft').onclick=async()=>{if(!active||saving)return;saving=true;try{await saveDraft();$('aiReviewStatus').textContent='修改已保存到雲端。';paint()}catch(e){$('aiReviewStatus').textContent='儲存失敗：'+e.message}finally{saving=false}};
$('aiSave').onclick=async()=>{if(!active||saving)return;saving=true;const btn=$('aiSave');btn.disabled=true;try{capture();const a=active;const selected=a.lines.filter(x=>x.status==='pending'&&x._selected);if(!selected.length)throw Error('請先勾選要匯入的商品');if(!a.store.value.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(a.date.value))throw Error('請先填寫店家及正確日期');selected.forEach(x=>validate(x,true));if(!confirm(`確定匯入 ${selected.length} 項商品？其他項目會保留待處理。`))return;
 await saveDraft();let done=0;for(const line of selected){const item={user_id:user.id,name:line.name,date:a.date.value,store:a.store.value.trim(),category:'其他',spec:line.spec,barcode:'',amount:line.amount,qty:line.qty,receipt_line_id:line.id};const inserted=await client.from('market_items').insert(item).select('id').single();let itemId=inserted.data?.id;if(inserted.error){const found=await client.from('market_items').select('id').eq('receipt_line_id',line.id).maybeSingle();if(found.error||!found.data?.id)throw inserted.error;itemId=found.data.id;}errorOf(await client.from('market_receipt_lines').update({status:'imported',item_id:itemId}).eq('id',line.id).eq('user_id',user.id));line.status='imported';done++;}
 await sync();await refreshCardProgress(a.r.id);paint();const p=progress(a.lines);$('aiReviewStatus').textContent=`本次已匯入 ${done} 項；目前 ${p.imported}/${p.total} 項已匯入，${p.pending} 項待處理。`;
 }catch(e){$('aiReviewStatus').textContent='匯入中斷：'+(e.message||String(e))+'。已成功的項目不會因重試而重複新增；請重新開啟核對清單。'}finally{saving=false;btn.disabled=false}};
$('aiClose').onclick=()=>{if(saving)return;if(active&&active.rows.some(x=>x.line.status!=='imported')&&!confirm('未按「儲存修改」的文字變更可能遺失。確定關閉？'))return;dlg.close()};
async function refreshCardProgress(receiptId){if(!client||!user)return;try{const lines=await loadLines(receiptId);const cards=[...$('receiptList').querySelectorAll('.receipt-card')];const receipts=receiptRecords||[];for(let i=0;i<cards.length;i++){if(receipts[i]?.id!==receiptId)continue;const card=cards[i];let node=card.querySelector('.aiProgressLabel');if(!node){node=el('div',{class:'tiny aiProgressLabel'});card.querySelector('.meta')?.after(node)}updateLegacyReceiptCard(card, receipts[i], lines);
if(lines.length){const p=progress(lines);node.textContent=`AI 清單：已匯入 ${p.imported}/${p.total} 項｜待處理 ${p.pending} 項｜略過 ${p.skipped} 項${p.pending===0?'｜清單已處理完畢':''}`;}else node.textContent='尚未建立 AI 逐項清單（舊版已匯入的商品不會自動歸屬到這張收據）';}}catch(e){console.warn('AI progress:',e.message)}}
function isCompletedLegacyReceipt(r, lines) {
  return r?.status === 'reviewed' && lines.length === 0;
}

function updateLegacyReceiptCard(card, r, lines) {
  const legacyCompleted = isCompletedLegacyReceipt(r, lines);

  const analyzeButton = card.querySelector('.aiAnalyze');
  const continueButton = card.querySelector('.aiContinue');
  const progressLabel = card.querySelector('.aiProgressLabel');

if (analyzeButton) analyzeButton.style.display = legacyCompleted ? 'none' : '';
if (continueButton) continueButton.style.display = legacyCompleted ? 'none' : '';
if (progressLabel) progressLabel.style.display = legacyCompleted ? 'none' : '';
}
 const root=$('receiptList');if(!root)return;let busy=false;const observer=new MutationObserver(()=>{if(busy)return;busy=true;try{const cards=[...root.querySelectorAll('.receipt-card')],receipts=receiptRecords||[];cards.forEach((card,i)=>{const r=receipts[i];if(!r)return;const actions=card.querySelector('.actions');if(!actions||card.querySelector('.aiAnalyze'))return;const analyze=el('button',{class:'btn red aiAnalyze',type:'button'},'AI 辨識收據');analyze.onclick=()=>analyzeReceipt(r,analyze);const review=el('button',{class:'btn secondary aiContinue',type:'button'},'繼續核對');review.onclick=()=>openReceipt(r);actions.prepend(analyze,review);refreshCardProgress(r.id)})}finally{busy=false}});observer.observe(root,{childList:true,subtree:true});
})();
