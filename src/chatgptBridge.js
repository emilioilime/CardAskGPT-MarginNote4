var CardAskGPTBridge = {
  makeInjection: function (payloads, temporaryChatEnabled, questionOptions) {
    var normalizedPayloads = Array.isArray(payloads) ? payloads : [payloads]
    var normalizedOptions = questionOptions || {}
    var questionMode =
      normalizedOptions.mode === "question" ||
      normalizedOptions.questionModeEnabled === true
    var presetPrompt = questionMode
      ? String(normalizedOptions.prompt || "").replace(/^\s+|\s+$/g, "")
      : ""
    var autoSend = questionMode && normalizedOptions.autoSend === true
    var serializedPayloads = JSON.stringify(normalizedPayloads)
    var serializedTemporary = temporaryChatEnabled ? "true" : "false"
    var serializedQuestionMode = questionMode ? "true" : "false"
    var serializedPresetPrompt = JSON.stringify(presetPrompt)
    var serializedAutoSend = autoSend ? "true" : "false"
    var token = JSON.stringify(
      normalizedPayloads
        .map(function (payload) {
          return String((payload && payload.id) || "card")
        })
        .join("-") +
        "-" +
        String(Date.now())
    )

    return (
      "(function () {" +
      "'use strict';" +
      "var cards=" +
      serializedPayloads +
      ";" +
      "var wantTemporary=" +
      serializedTemporary +
      ";" +
      "var questionMode=" +
      serializedQuestionMode +
      ";" +
      "var presetPrompt=" +
      serializedPresetPrompt +
      ";" +
      "var autoSend=" +
      serializedAutoSend +
      ";" +
      "var runToken=" +
      token +
      ";" +
      "window.__mnCardAskGPTRunToken=runToken;" +
      "function active(){return window.__mnCardAskGPTRunToken===runToken;}" +
      "function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}" +
      "function notify(code,detail){" +
      "try{document.dispatchEvent(new CustomEvent('cardaskgpt-status',{detail:{code:code,detail:detail||''}}));}catch(error){}" +
      "var url='cardaskgpt://status?code='+encodeURIComponent(code)+'&detail='+encodeURIComponent(detail||'');" +
      "window.location.href=url;" +
      "}" +
      "function normalizedLabel(el){" +
      "return [el.getAttribute('aria-label'),el.getAttribute('title'),el.textContent].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim();" +
      "}" +
      "function composer(){" +
      "return document.querySelector('#prompt-textarea')||document.querySelector('textarea[placeholder]')||document.querySelector('[contenteditable=\"true\"][data-virtualkeyboard]')||document.querySelector('main [contenteditable=\"true\"]');" +
      "}" +
      "function composerText(target){" +
      "if(!target)return '';" +
      "if(typeof target.value==='string')return target.value;" +
      "return target.innerText||target.textContent||'';" +
      "}" +
      "function dispatchComposerInput(target,text){" +
      "var event;" +
      "try{event=new InputEvent('input',{bubbles:true,cancelable:false,inputType:'insertText',data:text});}" +
      "catch(error){event=new Event('input',{bubbles:true,cancelable:false});}" +
      "target.dispatchEvent(event);" +
      "target.dispatchEvent(new Event('change',{bubbles:true}));" +
      "}" +
      "function setComposerText(target,text){" +
      "if(!target)return false;" +
      "text=String(text||'');" +
      "target.focus();" +
      "if(typeof target.value==='string'){" +
      "var current=target,descriptor=null;" +
      "while(current&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(current,'value');current=Object.getPrototypeOf(current);}" +
      "if(descriptor&&descriptor.set)descriptor.set.call(target,text);else target.value=text;" +
      "}else{" +
      "target.innerHTML='';" +
      "if(text){var paragraph=document.createElement('p');paragraph.textContent=text;target.appendChild(paragraph);}" +
      "}" +
      "dispatchComposerInput(target,text);" +
      "return true;" +
      "}" +
      "function clearManagedPrompt(target){" +
      "var managed=String(window.__mnCardAskGPTManagedPrompt||'');" +
      "if(managed&&composerText(target).replace(/^\\s+|\\s+$/g,'')===managed.replace(/^\\s+|\\s+$/g,''))setComposerText(target,'');" +
      "window.__mnCardAskGPTManagedPrompt='';" +
      "}" +
      "async function waitForComposer(timeout){" +
      "var started=Date.now();" +
      "while(active()&&Date.now()-started<timeout){" +
      "var target=composer();" +
      "if(target)return target;" +
      "await sleep(300);" +
      "}" +
      "return null;" +
      "}" +
      "async function ensureTemporary(){" +
      "if(!wantTemporary)return 'disabled';" +
      "var all=Array.prototype.slice.call(document.querySelectorAll('button,[role=\"button\"]'));" +
      "var match=all.find(function(el){" +
      "var label=normalizedLabel(el);" +
      "return /(temporary chat|temporary|临时聊天|临时对话|暫時聊天)/i.test(label);" +
      "});" +
      "if(!match)return 'not-found';" +
      "var label=normalizedLabel(match);" +
      "var state=(match.getAttribute('aria-pressed')||match.getAttribute('data-state')||'').toLowerCase();" +
      "var activeState=state==='true'||state==='on'||state==='checked'||/(turn off|disable|exit temporary|关闭临时|退出临时)/i.test(label);" +
      "if(activeState)return 'already-on';" +
      "try{" +
      "match.click();" +
      "await sleep(1200);" +
      "return 'enabled';" +
      "}catch(error){return 'failed';}" +
      "}" +
      "function fontFor(kind){" +
      "if(kind==='title')return {size:34,weight:700,color:'#171717',gap:18};" +
      "if(kind==='linked-title')return {size:27,weight:650,color:'#222222',gap:14};" +
      "if(kind==='comment')return {size:25,weight:400,color:'#282828',gap:18};" +
      "return {size:26,weight:400,color:'#202020',gap:18};" +
      "}" +
      "function wrapLines(ctx,text,maxWidth){" +
      "var result=[];" +
      "String(text||'').split(/\\r?\\n/).forEach(function(paragraph){" +
      "if(!paragraph){result.push('');return;}" +
      "var line='';" +
      "Array.from(paragraph).forEach(function(ch){" +
      "var candidate=line+ch;" +
      "if(line&&ctx.measureText(candidate).width>maxWidth){result.push(line);line=ch;}else{line=candidate;}" +
      "});" +
      "if(line)result.push(line);" +
      "});" +
      "return result;" +
      "}" +
      "function loadImage(src){" +
      "return new Promise(function(resolve){" +
      "var image=new Image();" +
      "image.onload=function(){resolve(image);};" +
      "image.onerror=function(){resolve(null);};" +
      "image.src=src;" +
      "});" +
      "}" +
      "async function createItems(card){" +
      "var measure=document.createElement('canvas').getContext('2d');" +
      "var items=[{type:'header',text:'MarginNote 卡片'}];" +
      "for(var i=0;i<card.blocks.length;i++){" +
      "var block=card.blocks[i];" +
      "if(block.type==='text'){" +
      "var style=fontFor(block.kind);" +
      "measure.font=style.weight+' '+style.size+'px -apple-system,BlinkMacSystemFont,\"PingFang SC\",\"Helvetica Neue\",Arial,sans-serif';" +
      "var lines=wrapLines(measure,block.text,780);" +
      "for(var j=0;j<lines.length;j++)items.push({type:'line',text:lines[j],style:style,first:j===0,kind:block.kind});" +
      "items.push({type:'space',height:style.gap});" +
      "}else if(block.type==='image'){" +
      "var image=await loadImage(block.dataURL);" +
      "if(image)items.push({type:'image',image:image});" +
      "items.push({type:'space',height:18});" +
      "}" +
      "}" +
      "return items;" +
      "}" +
      "function imageSize(item){" +
      "var naturalWidth=item.image.naturalWidth||item.image.width||780;" +
      "var naturalHeight=item.image.naturalHeight||item.image.height||400;" +
      "var scale=Math.min(1,780/naturalWidth,4100/naturalHeight);" +
      "return {width:Math.max(1,Math.round(naturalWidth*scale)),height:Math.max(1,Math.round(naturalHeight*scale))};" +
      "}" +
      "function itemHeight(item){" +
      "if(item.type==='header')return 66;" +
      "if(item.type==='space')return item.height;" +
      "if(item.type==='line')return Math.ceil(item.style.size*1.55);" +
      "if(item.type==='image')return imageSize(item).height;" +
      "return 0;" +
      "}" +
      "function roundedRect(ctx,x,y,w,h,r){" +
      "ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();" +
      "}" +
      "function canvasBlob(canvas){" +
      "return new Promise(function(resolve){" +
      "if(canvas.toBlob){canvas.toBlob(function(blob){resolve(blob);},'image/png');}" +
      "else{fetch(canvas.toDataURL('image/png')).then(function(r){return r.blob();}).then(resolve);}" +
      "});" +
      "}" +
      "async function renderFiles(){" +
      "var files=[];" +
      "for(var cardIndex=0;cardIndex<cards.length;cardIndex++){" +
      "var card=cards[cardIndex];" +
      "var items=await createItems(card);" +
      "var contentHeight=104;" +
      "items.forEach(function(item){contentHeight+=itemHeight(item);});" +
      "var logicalHeight=Math.max(520,contentHeight+70);" +
      "var renderScale=Math.min(1,14000/logicalHeight);" +
      "var canvas=document.createElement('canvas');" +
      "canvas.width=Math.max(1,Math.round(900*renderScale));" +
      "canvas.height=Math.max(1,Math.round(logicalHeight*renderScale));" +
      "var ctx=canvas.getContext('2d');" +
      "if(renderScale!==1)ctx.scale(renderScale,renderScale);" +
      "ctx.fillStyle='#f3efe5';ctx.fillRect(0,0,900,logicalHeight);" +
      "ctx.fillStyle='#fffdf8';roundedRect(ctx,18,18,864,logicalHeight-36,22);ctx.fill();" +
      "ctx.strokeStyle='#d8d1c2';ctx.lineWidth=2;roundedRect(ctx,18,18,864,logicalHeight-36,22);ctx.stroke();" +
      "var y=54;" +
      "ctx.fillStyle='#736b5d';ctx.font='600 19px -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif';ctx.fillText('MarginNote 卡片',58,y);" +
      "if(card.page){ctx.textAlign='right';ctx.fillText('第 '+card.page+' 页',842,y);ctx.textAlign='left';}" +
      "y=96;" +
      "for(var i=0;i<items.length;i++){" +
      "var item=items[i];" +
      "if(item.type==='header')continue;" +
      "if(item.type==='space'){y+=item.height;continue;}" +
      "if(item.type==='line'){" +
      "ctx.fillStyle=item.style.color;" +
      "ctx.font=item.style.weight+' '+item.style.size+'px -apple-system,BlinkMacSystemFont,\"PingFang SC\",\"Helvetica Neue\",Arial,sans-serif';" +
      "if(item.kind==='comment'&&item.first){ctx.fillStyle='#b7ad9b';ctx.fillRect(58,y-12,784,2);y+=18;ctx.fillStyle=item.style.color;}" +
      "ctx.fillText(item.text,58,y);y+=itemHeight(item);" +
      "}else if(item.type==='image'){" +
      "var targetSize=imageSize(item);" +
      "ctx.drawImage(item.image,58+(780-targetSize.width)/2,y,targetSize.width,targetSize.height);y+=targetSize.height;" +
      "}" +
      "}" +
      "ctx.fillStyle='#9a9183';ctx.font='16px -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif';ctx.textAlign='right';" +
      "ctx.fillText('卡片 '+(cardIndex+1)+' / '+cards.length,842,logicalHeight-40);ctx.textAlign='left';" +
      "var blob=await canvasBlob(canvas);" +
      "if(blob)files.push(new File([blob],'marginnote-card-'+(cardIndex+1)+'.png',{type:'image/png',lastModified:Date.now()}));" +
      "}" +
      "return files;" +
      "}" +
      "function attachmentButton(){" +
      "var buttons=Array.prototype.slice.call(document.querySelectorAll('button,[role=\"button\"]'));" +
      "return buttons.find(function(el){return /(attach|attachment|upload|add (photos|files?)|添加照片|添加文件|添加|上传|附件)/i.test(normalizedLabel(el));});" +
      "}" +
      "function fileInput(){" +
      "var inputs=Array.prototype.slice.call(document.querySelectorAll('input[type=\"file\"]'));" +
      "return inputs.find(function(input){var accept=(input.getAttribute('accept')||'').toLowerCase();return !accept||accept.indexOf('image')>=0||accept.indexOf('*')>=0;})||inputs[0]||null;" +
      "}" +
      "function composerScope(target){" +
      "var current=target;" +
      "for(var depth=0;current&&depth<9;depth++){" +
      "if(current.tagName==='FORM')return current;" +
      "current=current.parentElement;" +
      "}" +
      "return target.parentElement||document;" +
      "}" +
      "function sendButton(target){" +
      "var scope=composerScope(target);" +
      "var direct=scope.querySelector('button[data-testid=\"send-button\"],button[aria-label*=\"Send\" i],button[aria-label*=\"发送\"],button[aria-label*=\"提交\"]');" +
      "if(direct)return direct;" +
      "return Array.prototype.slice.call(scope.querySelectorAll('button,[role=\"button\"]')).find(function(button){" +
      "return /^(send|发送|提交)(\\s|$)|send prompt/i.test(normalizedLabel(button));" +
      "})||null;" +
      "}" +
      "function uploadIsBusy(target){" +
      "var scope=composerScope(target);" +
      "var busy=scope.querySelector('[data-state=\"uploading\"],[data-testid*=\"uploading\"],[aria-label*=\"Uploading\" i],[aria-label*=\"上传中\"]');" +
      "return Boolean(busy);" +
      "}" +
      "async function waitForSendReady(target,timeout){" +
      "var started=Date.now(),stable=0;" +
      "while(active()&&Date.now()-started<timeout){" +
      "var button=sendButton(target);" +
      "var disabled=!button||button.disabled||String(button.getAttribute('aria-disabled')||'').toLowerCase()==='true';" +
      "if(!disabled&&!uploadIsBusy(target)){stable+=1;if(stable>=3)return button;}else{stable=0;}" +
      "await sleep(300);" +
      "}" +
      "return null;" +
      "}" +
      "function attachmentRemovalButtons(target){" +
      "var scope=composerScope(target);" +
      "return Array.prototype.slice.call(scope.querySelectorAll('button,[role=\"button\"]')).filter(function(button){" +
      "var label=normalizedLabel(button);" +
      "return /(remove|delete|clear|移除|删除|清除)/i.test(label)&&/(attachment|file|image|upload|photo|附件|文件|图片|照片)/i.test(label);" +
      "});" +
      "}" +
      "async function clearExistingAttachments(target){" +
      "var removed=0;" +
      "for(var attempt=0;attempt<50&&active();attempt++){" +
      "var buttons=attachmentRemovalButtons(target);" +
      "if(!buttons.length)break;" +
      "try{buttons[0].click();removed+=1;}catch(error){break;}" +
      "await sleep(120);" +
      "}" +
      "return removed;" +
      "}" +
      "async function uploadFiles(files,target){" +
      "var input=fileInput();" +
      "if(!input){" +
      "var button=attachmentButton();" +
      "if(button){button.click();await sleep(450);input=fileInput();}" +
      "}" +
      "var transfer=new DataTransfer();" +
      "files.forEach(function(file){transfer.items.add(file);});" +
      "if(input){" +
      "try{input.files=transfer.files;}catch(error){Object.defineProperty(input,'files',{value:transfer.files,configurable:true});}" +
      "input.dispatchEvent(new Event('input',{bubbles:true}));" +
      "input.dispatchEvent(new Event('change',{bubbles:true}));" +
      "return 'file-input';" +
      "}" +
      "try{" +
      "target.focus();" +
      "var pasteEvent;" +
      "try{pasteEvent=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer});}" +
      "catch(error){pasteEvent=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(pasteEvent,'clipboardData',{value:transfer});}" +
      "target.dispatchEvent(pasteEvent);" +
      "return 'paste-event';" +
      "}catch(error){return '';}" +
      "}" +
      "(async function run(){" +
      "try{" +
      "var target=await waitForComposer(24000);" +
      "if(!active())return;" +
      "if(!target){notify('login-required','未找到 ChatGPT 输入框');return;}" +
      "if(!cards.length){" +
      "var cleared=await clearExistingAttachments(target);" +
      "clearManagedPrompt(target);" +
      "if(!active())return;" +
      "notify('selection-cleared','0|'+cleared);" +
      "return;" +
      "}" +
      "var temporaryStatus=await ensureTemporary();" +
      "if(!active())return;" +
      "target=await waitForComposer(6000)||target;" +
      "var files=await renderFiles();" +
      "if(!active())return;" +
      "if(!files.length){notify('render-failed','没有生成图片');return;}" +
      "var removed=await clearExistingAttachments(target);" +
      "if(!active())return;" +
      "var method=await uploadFiles(files,target);" +
      "if(!method){notify('upload-failed','网页未暴露文件输入接口');return;}" +
      "if(questionMode&&presetPrompt){" +
      "setComposerText(target,presetPrompt);" +
      "window.__mnCardAskGPTManagedPrompt=presetPrompt;" +
      "}else{" +
      "clearManagedPrompt(target);" +
      "}" +
      "if(autoSend&&presetPrompt){" +
      "await sleep(900);" +
      "if(!active())return;" +
      "var submit=await waitForSendReady(target,18000);" +
      "if(!submit){notify('auto-send-failed','图片和提示词已准备，但发送按钮不可用');return;}" +
      "submit.click();" +
      "window.__mnCardAskGPTManagedPrompt='';" +
      "notify('sent',method+'|'+temporaryStatus+'|'+files.length+'|'+removed);" +
      "return;" +
      "}" +
      "target.focus();" +
      "notify(questionMode?'prepared':'uploaded',method+'|'+temporaryStatus+'|'+files.length+'|'+removed);" +
      "}catch(error){notify('failed',String(error&&error.message||error));}" +
      "})();" +
      "return 'started';" +
      "})();"
    )
  },

  makeClipboardBridge: function () {
    return (
      "(function () {" +
      "'use strict';" +
      "if(window.__mnCardAskGPTClipboardBridgeInstalled)return 'already-installed';" +
      "window.__mnCardAskGPTClipboardBridgeInstalled=true;" +
      "window.__mnCardAskGPTClipboardPayload=null;" +
      "window.__mnCardAskGPTPasteTarget=Boolean(window.__mnCardAskGPTPasteTarget);" +
      "var signalCount=0;" +
      "function stringValue(value){return String(value===undefined||value===null?'':value);}" +
      "function rtfEscape(value){" +
      "var text=stringValue(value),result='';" +
      "for(var i=0;i<text.length;i++){" +
      "var code=text.charCodeAt(i),character=text.charAt(i);" +
      "if(character==='\\\\'||character==='{'||character==='}')result+='\\\\'+character;" +
      "else if(character==='\\n'||character==='\\r'){if(character==='\\n')result+='\\\\line ';}" +
      "else if(character==='\\t')result+='\\\\tab ';" +
      "else if(code>=32&&code<=126)result+=character;" +
      "else result+='\\\\u'+String(code>32767?code-65536:code)+'?';" +
      "}" +
      "return result;" +
      "}" +
      "function rtfChildren(node){" +
      "var result='',children=node&&node.childNodes||[];" +
      "for(var i=0;i<children.length;i++)result+=rtfNode(children[i]);" +
      "return result;" +
      "}" +
      "function rtfNode(node){" +
      "if(!node)return '';" +
      "if(node.nodeType===3)return rtfEscape(node.nodeValue||node.textContent||'');" +
      "if(node.nodeType!==1)return '';" +
      "var tag=stringValue(node.tagName).toLowerCase(),content=rtfChildren(node);" +
      "if(tag==='br')return '\\\\line ';" +
      "if(/^h[1-6]$/.test(tag))return '{\\\\b\\\\fs'+String(Math.max(28,44-(Number(tag.slice(1))-1)*4))+' '+content+'}\\\\par ';" +
      "if(tag==='strong'||tag==='b')return '{\\\\b '+content+'}';" +
      "if(tag==='em'||tag==='i')return '{\\\\i '+content+'}';" +
      "if(tag==='u')return '{\\\\ul '+content+'\\\\ulnone }';" +
      "if(tag==='s'||tag==='del')return '{\\\\strike '+content+'}';" +
      "if(tag==='code')return '{\\\\f1 '+content+'}';" +
      "if(tag==='pre')return '{\\\\f1\\\\fs22 '+content+'}\\\\par ';" +
      "if(tag==='li'){" +
      "var parentTag=stringValue(node.parentNode&&node.parentNode.tagName).toLowerCase();" +
      "if(parentTag==='ol'){" +
      "var siblings=node.parentNode&&node.parentNode.children||[],position=1;" +
      "for(var siblingIndex=0;siblingIndex<siblings.length;siblingIndex++){if(siblings[siblingIndex]===node){position=siblingIndex+1;break;}}" +
      "return rtfEscape(String(position)+'.')+'\\\\tab '+content+'\\\\par ';" +
      "}" +
      "return '\\\\bullet\\\\tab '+content+'\\\\par ';" +
      "}" +
      "if(tag==='blockquote')return '{\\\\li360\\\\i '+content+'}\\\\par ';" +
      "if(tag==='td'||tag==='th')return content+'\\\\tab ';" +
      "if(tag==='tr')return content+'\\\\par ';" +
      "if(tag==='p'||tag==='div')return content+'\\\\par ';" +
      "return content;" +
      "}" +
      "function rtfFromHtml(value){" +
      "var html=stringValue(value);" +
      "if(!html)return '';" +
      "try{" +
      "var holder=document.createElement('div');holder.innerHTML=html;" +
      "return '{\\\\rtf1\\\\ansi\\\\ansicpg65001\\\\deff0{\\\\fonttbl{\\\\f0\\\\fswiss Helvetica;}{\\\\f1\\\\fmodern Menlo;}}\\\\viewkind4\\\\uc1\\\\pard\\\\f0\\\\fs24 '+rtfChildren(holder)+'}';" +
      "}catch(error){return '';}" +
      "}" +
      "function labelFor(element){" +
      "return [element&&element.getAttribute&&element.getAttribute('aria-label'),element&&element.getAttribute&&element.getAttribute('title'),element&&element.textContent].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim();" +
      "}" +
      "function normalizedPayload(value,source){" +
      "var payload=typeof value==='string'?{plainText:value}:value||{};" +
      "payload={plainText:stringValue(payload.plainText),html:stringValue(payload.html),rtf:stringValue(payload.rtf),markdown:stringValue(payload.markdown),htmlUtf8Base64:stringValue(payload.htmlUtf8Base64),htmlAscii:stringValue(payload.htmlAscii),rtfUtf8Base64:stringValue(payload.rtfUtf8Base64),markdownUtf8Base64:stringValue(payload.markdownUtf8Base64),source:source||payload.source||'copy'};" +
      "if(payload.html&&!payload.rtf)payload.rtf=rtfFromHtml(payload.html);" +
      "if(payload.html&&!payload.htmlUtf8Base64)payload.htmlUtf8Base64=utf8Base64(htmlDocument(payload.html));" +
      "if(payload.html&&!payload.htmlAscii)payload.htmlAscii=asciiHtml(htmlDocument(payload.html));" +
      "if(payload.rtf&&!payload.rtfUtf8Base64)payload.rtfUtf8Base64=utf8Base64(payload.rtf);" +
      "if(payload.markdown&&!payload.markdownUtf8Base64)payload.markdownUtf8Base64=utf8Base64(payload.markdown);" +
      "return payload;" +
      "}" +
      "function htmlDocument(value){" +
      "var html=stringValue(value);" +
      "if(!html)return '';" +
      "if(/<html(?:\\s|>)/i.test(html)){" +
      "if(!/<meta[^>]+charset\\s*=/i.test(html))html=html.replace(/<head(?:\\s[^>]*)?>/i,function(match){return match+'<meta charset=\"utf-8\">';});" +
      "return html;" +
      "}" +
      "return '<!doctype html><html><head><meta charset=\"utf-8\"></head><body><!--StartFragment-->'+html+'<!--EndFragment--></body></html>';" +
      "}" +
      "function utf8Base64(value){" +
      "try{return btoa(unescape(encodeURIComponent(stringValue(value))));}catch(error){return '';}" +
      "}" +
      "function asciiHtml(value){" +
      "var text=stringValue(value),result='';" +
      "for(var i=0;i<text.length;i++){" +
      "var code=text.charCodeAt(i);" +
      "if(code>=55296&&code<=56319&&i+1<text.length){" +
      "var low=text.charCodeAt(i+1);" +
      "if(low>=56320&&low<=57343){code=(code-55296)*1024+(low-56320)+65536;i+=1;}" +
      "}" +
      "result+=code>127?'&#x'+code.toString(16)+';':String.fromCharCode(code);" +
      "}" +
      "return result;" +
      "}" +
      "function hasContent(payload){return !!(payload.plainText||payload.html||payload.rtf||payload.markdown);}" +
      "function signal(value,source){" +
      "var payload=normalizedPayload(value,source);" +
      "if(!hasContent(payload))return null;" +
      "window.__mnCardAskGPTClipboardPayload=payload;" +
      "signalCount+=1;" +
      "try{document.dispatchEvent(new CustomEvent('cardaskgpt-clipboard',{detail:{payload:payload,text:payload.plainText,source:payload.source}}));}catch(error){}" +
      "var token=Date.now().toString(36)+'-'+signalCount+'-'+Math.random().toString(36).slice(2);" +
      "setTimeout(function(){window.location.href='cardaskgpt://clipboard?token='+encodeURIComponent(token);},0);" +
      "return payload;" +
      "}" +
      "function selectionPayload(event){" +
      "var payload={plainText:'',html:''};" +
      "if(event&&event.clipboardData){" +
      "try{payload.plainText=event.clipboardData.getData('text/plain')||'';}catch(error){}" +
      "try{payload.html=event.clipboardData.getData('text/html')||'';}catch(error){}" +
      "}" +
      "try{" +
      "var selection=window.getSelection?window.getSelection():null;" +
      "if(selection){" +
      "if(!payload.plainText)payload.plainText=selection.toString();" +
      "if(!payload.html&&selection.rangeCount){" +
      "var holder=document.createElement('div');" +
      "for(var i=0;i<selection.rangeCount;i++)holder.appendChild(selection.getRangeAt(i).cloneContents());" +
      "payload.html=holder.innerHTML;" +
      "}" +
      "}" +
      "}catch(error){}" +
      "return payload;" +
      "}" +
      "document.addEventListener('copy',function(event){" +
      "signal(selectionPayload(event),'copy-event');" +
      "},true);" +
      "function safeOriginalCall(original,receiver,value){" +
      "try{" +
      "var result=original.call(receiver,value);" +
      "if(result&&typeof result.catch==='function')return result.catch(function(){return undefined;});" +
      "return Promise.resolve(result);" +
      "}catch(error){return Promise.resolve();}" +
      "}" +
      "function installWrapper(object,name,wrapper){" +
      "if(!object||typeof object[name]!=='function'||object[name].__mnCardAskGPTWrapped)return false;" +
      "wrapper.__mnCardAskGPTWrapped=true;" +
      "try{Object.defineProperty(object,name,{value:wrapper,configurable:true,writable:true});}catch(error){" +
      "try{object[name]=wrapper;}catch(assignError){}" +
      "}" +
      "return object[name]===wrapper;" +
      "}" +
      "function payloadFromClipboardItems(items){" +
      "var payload={plainText:'',html:'',rtf:'',markdown:''};" +
      "var tasks=[];" +
      "Array.prototype.slice.call(items||[]).forEach(function(item){" +
      "Array.prototype.slice.call(item&&item.types||[]).forEach(function(type){" +
      "var key=type==='text/plain'?'plainText':type==='text/html'?'html':type==='text/rtf'?'rtf':type==='text/markdown'?'markdown':'';" +
      "if(!key||payload[key]||!item.getType)return;" +
      "tasks.push(Promise.resolve(item.getType(type)).then(function(blob){" +
      "if(blob&&typeof blob.text==='function')return blob.text();" +
      "return String(blob===undefined||blob===null?'':blob);" +
      "}).then(function(value){if(!payload[key])payload[key]=stringValue(value);}).catch(function(){}));" +
      "});" +
      "});" +
      "return Promise.all(tasks).then(function(){return payload;});" +
      "}" +
      "var activeCopyContext=null;" +
      "var activeCopyContextAt=0;" +
      "function payloadForWriteText(text){" +
      "var payload={plainText:stringValue(text)};" +
      "if(activeCopyContext&&Date.now()-activeCopyContextAt<1800){" +
      "if(activeCopyContext.html)payload.html=activeCopyContext.html;" +
      "if(activeCopyContext.markdown)payload.markdown=stringValue(text);" +
      "}" +
      "return payload;" +
      "}" +
      "try{" +
      "var clipboard=navigator.clipboard;" +
      "if(clipboard&&typeof clipboard.writeText==='function'){" +
      "var originalWriteText=clipboard.writeText;" +
      "installWrapper(clipboard,'writeText',function(text){" +
      "signal(payloadForWriteText(text),'clipboard-writeText');" +
      "return safeOriginalCall(originalWriteText,clipboard,text);" +
      "});" +
      "}" +
      "if(clipboard&&typeof clipboard.write==='function'){" +
      "var originalWrite=clipboard.write;" +
      "installWrapper(clipboard,'write',function(items){" +
      "var originalResult=safeOriginalCall(originalWrite,clipboard,items);" +
      "payloadFromClipboardItems(items).then(function(payload){signal(payload,'clipboard-write');});" +
      "return originalResult;" +
      "});" +
      "}" +
      "}catch(error){}" +
      "function htmlFor(element){return element?'<div>'+stringValue(element.innerHTML)+'</div>':'';}" +
      "function fallbackForButton(button,label){" +
      "var responseScope=button.closest('[data-message-author-role=\"assistant\"]')||button.closest('[data-testid^=\"conversation-turn\"]')||button.closest('article');" +
      "var current=button;" +
      "for(var depth=0;current&&current!==responseScope&&depth<9;depth++,current=current.parentElement){" +
      "var code=current.querySelector&&current.querySelector('pre code,pre,[data-testid*=\"code\"],[class*=\"code-block\"] code');" +
      "if(code){" +
      "var codeText=stringValue(code.innerText||code.textContent);" +
      "if(codeText)return {plainText:codeText,markdown:/markdown/i.test(label)?codeText:''};" +
      "}" +
      "}" +
      "if(!responseScope)return null;" +
      "var content=responseScope.querySelector('.markdown,[class*=\"markdown\"],[class*=\"prose\"],[data-message-author-role=\"assistant\"]')||responseScope;" +
      "return {plainText:stringValue(content.innerText||content.textContent),html:htmlFor(content)};" +
      "}" +
      "document.addEventListener('click',function(event){" +
      "var button=event.target&&event.target.closest?event.target.closest('button,[role=\"button\"]'):null;" +
      "if(!button)return;" +
      "var label=labelFor(button);" +
      "var looksLikeCopy=/(copy|复制)/i.test(label)||/copy/i.test(stringValue(button.getAttribute&&button.getAttribute('data-testid')));" +
      "if(!looksLikeCopy||/(link|链接)/i.test(label))return;" +
      "var fallbackPayload=fallbackForButton(button,label);" +
      "activeCopyContext=fallbackPayload;" +
      "activeCopyContextAt=Date.now();" +
      "var countBefore=signalCount;" +
      "setTimeout(function(){" +
      "if(signalCount!==countBefore)return;" +
      "signal(fallbackPayload,'copy-button');" +
      "},260);" +
      "},true);" +
      "document.addEventListener('pointerdown',function(){" +
      "if(!window.__mnCardAskGPTPasteTarget)return;" +
      "window.__mnCardAskGPTPasteTarget=false;" +
      "setTimeout(function(){window.location.href='cardaskgpt://web-focus';},0);" +
      "},true);" +
      "document.addEventListener('paste',function(event){" +
      "if(!window.__mnCardAskGPTPasteTarget)return;" +
      "event.preventDefault();" +
      "event.stopPropagation();" +
      "window.__mnCardAskGPTPasteTarget=false;" +
      "setTimeout(function(){window.location.href='cardaskgpt://paste-card';},0);" +
      "},true);" +
      "return 'installed';" +
      "})();"
    )
  }
}
