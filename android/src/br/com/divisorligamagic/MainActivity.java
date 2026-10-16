package br.com.divisorligamagic;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import android.provider.OpenableColumns;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainActivity extends Activity {
  static final String HOME="https://www.ligamagic.com.br/", CART=HOME+"?view=mp/carrinho&open=1", LOCAL="https://appassets.androidplatform.net/", DEMO=HOME+"__divisor_test__/cart";
  final ArrayList<Tab> tabs=new ArrayList<>(); final HashMap<String,Object> session=new HashMap<>();
  int nextId=1, selected=-1, target=-1; boolean panelTab=false, closing=false;
  FrameLayout stage, browserArea, overlay; LinearLayout strip, root; TextView title; ProgressBar progress;
  WebView panel; Tab divider; android.content.SharedPreferences prefs;
  ValueCallback<Uri[]> upload; byte[] exportBytes; String exportRequest;
  final Handler handler=new Handler(Looper.getMainLooper());
  static class Tab {int id; WebView web; String title="LigaMagic",url=HOME,document=UUID.randomUUID().toString();boolean loading=false,demo=false;}
  int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
  LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w<0?w:dp(w),h<0?h:dp(h));}
  Button button(String text,String label,Runnable fn){Button b=new Button(this);b.setText(text);b.setTextSize(12);b.setTextColor(Color.parseColor("#d8efdf"));b.setContentDescription(label);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setPadding(dp(8),0,dp(8),0);b.setOnClickListener(v->fn.run());return b;}
  public void onCreate(Bundle state){super.onCreate(state);prefs=getSharedPreferences("liga_divisor",MODE_PRIVATE);WebView.setWebContentsDebuggingEnabled(true);CookieManager.getInstance().setAcceptCookie(true);
    root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(Color.parseColor("#12231b"));setContentView(root);
    root.setOnApplyWindowInsetsListener((v,insets)->{root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
    LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);title=new TextView(this);title.setText("◈ Liga Divisor");title.setTextSize(18);title.setTextColor(Color.WHITE);title.setPadding(dp(12),0,0,0);bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));bar.addView(button("+","Nova aba LigaMagic",()->newTab(HOME,false)),lp(48,48));bar.addView(button("⋮","Menu do navegador",this::menu),lp(48,48));root.addView(bar);
    HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);strip=new LinearLayout(this);scroll.addView(strip);root.addView(scroll,lp(-1,44));
    progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);root.addView(progress,lp(-1,3));
    stage=new FrameLayout(this);root.addView(stage,new LinearLayout.LayoutParams(-1,0,1));browserArea=new FrameLayout(this);stage.addView(browserArea,new FrameLayout.LayoutParams(-1,-1));
    LinearLayout nav=new LinearLayout(this);String[] names={"‹ Voltar","↻ Atualizar","Carrinho","◈ Dividir"};Runnable[] actions={this::back,()->{Tab t=current();if(t!=null)t.web.reload();},()->{Tab t=current();if(t==null)newTab(CART,false);else{t.demo=false;t.web.loadUrl(CART);}},()->{Tab t=current();if(t!=null)openDivider(t.id,false);}};for(int i=0;i<names.length;i++)nav.addView(button(names[i],names[i],actions[i]),new LinearLayout.LayoutParams(0,dp(52),1));root.addView(nav);
    try{JSONArray saved=new JSONArray(prefs.getString("browserTabs","[]"));for(int i=0;i<Math.min(saved.length(),12);i++){String u=saved.getString(i);if(u.startsWith("https://")&&!u.equals(DEMO))newTab(u,false);}}catch(Exception ignored){}
    if(tabs.isEmpty())newTab(HOME,false);
  }
  Tab current(){return find(selected);} Tab find(int id){for(Tab t:tabs)if(t.id==id)return t;return null;}
  boolean liga(String url){try{Uri u=Uri.parse(url);String h=u.getHost();return "https".equals(u.getScheme())&&h!=null&&(h.equals("ligamagic.com.br")||h.endsWith(".ligamagic.com.br")||h.equals("ligamagic.com")||h.endsWith(".ligamagic.com"));}catch(Exception e){return false;}}
  String asset(String name){try(InputStream in=getAssets().open(name)){return readUtf8(in);}catch(IOException e){throw new IllegalStateException("Arquivo interno ausente: "+name,e);}}
  String readUtf8(InputStream in)throws IOException{ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=in.read(buf))>0)b.write(buf,0,n);return b.toString("UTF-8");}

  void settings(WebView w){WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setBuiltInZoomControls(true);s.setDisplayZoomControls(false);s.setSupportMultipleWindows(true);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);CookieManager.getInstance().setAcceptThirdPartyCookies(w,true);w.setBackgroundColor(Color.WHITE);}
  void newTab(String url,boolean demo){if(tabs.size()>=12){toast("Limite de 12 abas. Feche uma para continuar.");return;}Tab t=new Tab();t.id=nextId++;t.demo=demo;t.web=new WebView(this);settings(t.web);t.web.setWebChromeClient(chrome(t,false));t.web.setWebViewClient(new WebViewClient(){
    public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){String u=r.getUrl().toString();if(u.startsWith("ligadivisor://open")){if(r.isForMainFrame()&&liga(w.getUrl()))openDivider(t.id,false);return true;}if(u.startsWith("https://"))return false;if(u.startsWith("http://")){w.loadUrl("https://"+u.substring(7));return true;}if(r.hasGesture()&&(u.startsWith("mailto:")||u.startsWith("tel:"))){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(u)));}catch(Exception ignored){}}return true;}
    public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){if(t.demo&&r.getUrl().toString().equals(DEMO))return response("text/html",asset("demo.html"));return null;}
    public void onPageStarted(WebView w,String u,android.graphics.Bitmap icon){t.loading=true;t.url=u;t.document=UUID.randomUUID().toString();if(selected==t.id)progress.setVisibility(View.VISIBLE);renderTabs();}
    public void onPageFinished(WebView w,String u){t.loading=false;t.url=u;if(selected==t.id)progress.setVisibility(View.GONE);if(liga(u)){try{inject(t);}catch(RuntimeException e){android.util.Log.e("LigaDivisor","Falha no divisor",e);toast("Não foi possível carregar o divisor. Reinstale a versão atualizada.");}}renderTabs();saveTabs();CookieManager.getInstance().flush();}
    public void onReceivedError(WebView w,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())toast("Página não carregou: "+e.getDescription()+". Use Atualizar.");}
  });
    t.web.setDownloadListener((downloadUrl,ua,disposition,mime,length)->{if(downloadUrl.startsWith("https://")){new AlertDialog.Builder(this).setMessage("Abrir este download no navegador do celular?").setPositiveButton("Abrir",(d,x)->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(downloadUrl)))).setNegativeButton("Cancelar",null).show();}else toast("Use a exportação do painel para salvar XLSX e backups.");});tabs.add(t);select(t.id);t.web.loadUrl(url);
  }
  WebResourceResponse response(String mime,String text){return new WebResourceResponse(mime,"UTF-8",new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));}
  void inject(Tab t){String js=asset("panel/core.js")+"\n"+asset("panel/reader.js")+"\n"+asset("launcher.js");t.web.evaluateJavascript(js,null);}
  void renderTabs(){strip.removeAllViews();for(Tab t:tabs){LinearLayout chip=new LinearLayout(this);chip.setBackgroundColor(Color.parseColor(t.id==selected&&!panelTab?"#345a45":"#1c3024"));String name=t.demo?"Teste local":t.title;Button b=button(name.length()>19?name.substring(0,18)+"…":name,"Selecionar aba "+t.id,()->select(t.id));chip.addView(b,lp(132,42));chip.addView(button("×","Fechar aba "+t.id,()->closeTab(t)),lp(36,42));strip.addView(chip);}if(divider!=null){strip.addView(button("◈ Divisão","Aba de divisão",()->showPanel(true)),lp(128,42));strip.addView(button("×","Fechar divisor",this::closeDivider),lp(36,42));}}
  void detach(View v){if(v.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)v.getParent()).removeView(v);}
  void select(int id){Tab t=find(id);if(t==null)return;hideOverlay();selected=id;panelTab=false;browserArea.removeAllViews();detach(t.web);browserArea.addView(t.web,new FrameLayout.LayoutParams(-1,-1));progress.setVisibility(t.loading?View.VISIBLE:View.GONE);renderTabs();}
  void closeTab(Tab t){if(t.id==target){new AlertDialog.Builder(this).setMessage("Esta aba está vinculada ao divisor. Feche o painel antes de fechar a aba ou mantenha-a aberta até concluir a operação.").setPositiveButton("OK",null).show();return;}tabs.remove(t);detach(t.web);t.web.destroy();if(tabs.isEmpty())newTab(HOME,false);else if(selected==t.id)select(tabs.get(0).id);renderTabs();saveTabs();}
  void saveTabs(){JSONArray a=new JSONArray();for(Tab t:tabs)if(!t.demo&&t.url.startsWith("https://"))a.put(t.url);prefs.edit().putString("browserTabs",a.toString()).apply();}
  void openDivider(int tabId,boolean inTab){Tab t=find(tabId);if(t==null)return;if(!liga(t.web.getUrl())){toast("Abra a LigaMagic nesta aba para dividir o carrinho.");return;}if(panel!=null&&target!=tabId){panel.evaluateJavascript("window.__operationRunning===true",value->{if("true".equals(value)){toast("Aguarde a remoção terminar antes de trocar de carrinho.");return;}target=tabId;showPanel(inTab);panel.evaluateJavascript("mobileRetarget()",null);});return;}target=tabId;ensurePanel();showPanel(inTab);}
  void ensurePanel(){if(panel!=null)return;panel=new WebView(this);settings(panel);panel.getSettings().setSupportMultipleWindows(false);panel.addJavascriptInterface(new Bridge(),"Native");panel.setWebChromeClient(chrome(null,true));panel.setWebViewClient(new WebViewClient(){
    public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){return !r.getUrl().toString().equals(LOCAL+"panel/panel.html");}
    public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){Uri u=r.getUrl();if(!"appassets.androidplatform.net".equals(u.getHost()))return response("text/plain","Bloqueado");String path=u.getPath();if(path==null||path.contains("..")||!path.startsWith("/panel/"))return response("text/plain","Não encontrado");String file=path.substring(1);String mime=file.endsWith(".js")?"application/javascript":file.endsWith(".css")?"text/css":"text/html";try{WebResourceResponse res=response(mime,asset(file));HashMap<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'");res.setResponseHeaders(headers);return res;}catch(Exception e){return response("text/plain","Não encontrado");}}
  });panel.loadUrl(LOCAL+"panel/panel.html");}
  void showPanel(boolean inTab){ensurePanel();hideOverlay();detach(panel);if(inTab){if(divider==null)divider=new Tab();panelTab=true;browserArea.removeAllViews();browserArea.addView(panel,new FrameLayout.LayoutParams(-1,-1));}else{if(panelTab){Tab t=find(selected);if(t!=null)select(t.id);}panelTab=false;overlay=new FrameLayout(this);overlay.setBackgroundColor(0xaa06130b);LinearLayout sheet=new LinearLayout(this);sheet.setOrientation(1);sheet.setBackgroundColor(Color.parseColor("#12231b"));LinearLayout controls=new LinearLayout(this);TextView heading=new TextView(this);heading.setText("  Divisor · aba "+target);heading.setTextColor(Color.WHITE);heading.setGravity(Gravity.CENTER_VERTICAL);controls.addView(heading,new LinearLayout.LayoutParams(0,dp(48),1));controls.addView(button("Outra aba","Abrir divisor em outra aba",()->showPanel(true)));controls.addView(button("Fechar","Fechar sobreposição",this::hideOverlay));sheet.addView(controls);sheet.addView(panel,new LinearLayout.LayoutParams(-1,0,1));FrameLayout.LayoutParams frame=new FrameLayout.LayoutParams(-1,-1);frame.topMargin=dp(24);overlay.addView(sheet,frame);stage.addView(overlay,new FrameLayout.LayoutParams(-1,-1));}renderTabs();}
  void closeDivider(){if(panel==null)return;panel.evaluateJavascript("window.__operationRunning===true",value->{if("true".equals(value)){toast("Aguarde a remoção terminar.");return;}hideOverlay();detach(panel);panel.destroy();panel=null;target=-1;divider=null;session.clear();select(selected);});}
  void hideOverlay(){if(overlay!=null){detach(panel);stage.removeView(overlay);overlay=null;}}
  void back(){if(overlay!=null){hideOverlay();return;}if(panelTab){select(selected);return;}Tab t=current();if(t!=null&&t.web.canGoBack())t.web.goBack();else new AlertDialog.Builder(this).setMessage("Sair do app? As listas e abas ficam salvas.").setPositiveButton("Sair",(d,w)->finish()).setNegativeButton("Ficar",null).show();}
  @Override public void onBackPressed(){back();}
  void menu(){String[] items={"Nova aba na LigaMagic","Ir para endereço HTTPS","Abrir divisor","Teste local (não altera compras)","Sobre o app"};new AlertDialog.Builder(this).setTitle("Liga Divisor").setItems(items,(d,i)->{if(i==0)newTab(HOME,false);if(i==1){EditText input=new EditText(this);input.setSingleLine(true);input.setText(HOME);new AlertDialog.Builder(this).setTitle("Endereço").setView(input).setPositiveButton("Abrir",(a,b)->{String u=input.getText().toString().trim();if(!u.startsWith("https://"))u="https://"+u;Tab t=current();if(t!=null){t.demo=false;t.web.loadUrl(u);}}).setNegativeButton("Cancelar",null).show();}if(i==2&&current()!=null)openDivider(current().id,false);if(i==3)newTab(DEMO,true);if(i==4)new AlertDialog.Builder(this).setTitle("Liga Divisor 1.1.0").setMessage("Navegador Android com divisor integrado.\n\nListas locais, múltiplas abas, XLSX e painel sobreposto. Não é um app oficial da LigaMagic.\n\nUse Backup das listas para transferir seus participantes do PC. O teste local não acessa uma compra real.").setPositiveButton("OK",null).show();}).show();}
  WebChromeClient chrome(Tab tab,boolean trusted){return new WebChromeClient(){
    public void onReceivedTitle(WebView w,String t){if(tab!=null){tab.title=t==null?"LigaMagic":t;renderTabs();}}
    public void onProgressChanged(WebView w,int n){if(tab!=null&&tab.id==selected)progress.setProgress(n);}
    public boolean onJsConfirm(WebView w,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Confirmar",(d,i)->result.confirm()).setNegativeButton("Cancelar",(d,i)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
    public boolean onJsAlert(WebView w,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("OK",(d,i)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
    public boolean onConsoleMessage(ConsoleMessage m){android.util.Log.d("LigaDivisorJS",m.message()+" @"+m.sourceId()+":"+m.lineNumber());return true;}
    public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams params){if(upload!=null)upload.onReceiveValue(null);upload=cb;try{Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,11);return true;}catch(Exception e){upload=null;cb.onReceiveValue(null);return true;}}
    public boolean onCreateWindow(WebView w,boolean dialog,boolean gesture,Message msg){if(trusted||!gesture)return false;WebView temp=new WebView(MainActivity.this);temp.setWebViewClient(new WebViewClient(){public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){String u=r.getUrl().toString();if(u.startsWith("https://"))newTab(u,false);temp.destroy();return true;}});((WebView.WebViewTransport)msg.obj).setWebView(temp);msg.sendToTarget();return true;}
  };}
  String cartDomain(JSONObject m)throws Exception{String d=m.getString("domain");if(!d.equals("ligamagic.com.br")&&!d.equals("ligamagic.com"))throw new Exception("Domínio inválido.");return d;}
  String cartCookie(String d)throws Exception{
    HashSet<String> values=new HashSet<>();
    for(String host:new String[]{d,"www."+d}){String raw=CookieManager.getInstance().getCookie("https://"+host+"/");if(raw!=null)for(String part:raw.split(";")){String item=part.trim();if(item.startsWith("carrinhoMP=")){String v=item.substring(11);if(!v.isEmpty())values.add(v);}}}
    if(values.size()>1)throw new Exception("Há referências diferentes de carrinho. Resolva-as no site antes de transferir.");return values.isEmpty()?null:values.iterator().next();
  }
  void validateCartValue(String v)throws Exception{if(v.isEmpty()||v.length()>3800)throw new Exception("Cookie inválido.");for(char c:v.toCharArray())if(c<33||c>126||c==';'||c=='"'||c=='\\')throw new Exception("Cookie inválido.");}
  void setCartSequence(String d,String v,int step,Runnable done,java.util.function.Consumer<String> failed){
    String[] hosts={d,"www."+d,d,"www."+d,"www."+d};
    String[] domains={"","","; Domain=."+d,"; Domain=.www."+d,"; Domain=."+d};
    String cookie=step==4?"carrinhoMP="+v+"; Path=/; Domain=."+d+"; Secure; SameSite=Lax; Max-Age=2592000":"carrinhoMP=; Path=/; Max-Age=0"+domains[step];
    CookieManager.getInstance().setCookie("https://"+hosts[step]+"/",cookie,ok->{
      if(!ok){failed.accept("O Android recusou a gravação do cookie.");return;}
      if(step<4)setCartSequence(d,v,step+1,done,failed);else{CookieManager.getInstance().flush();done.run();}
    });
  }
  class Bridge {@JavascriptInterface public void request(String id,String json){if(json.length()>20000000)return;handler.post(()->{try{dispatch(id,new JSONObject(json));}catch(Exception e){reply(id,null,e.getMessage());}});}}
  JSONObject tabInfo(Tab t)throws Exception{if(t==null)throw new Exception("Aba do carrinho fechada.");return new JSONObject().put("id",t.id).put("url",t.web.getUrl()).put("status",t.loading?"loading":"complete");}
  void dispatch(String req,JSONObject m)throws Exception{
    String type=m.getString("type");
    if(type.equals("CART_COOKIE_READ")){String d=cartDomain(m);reply(req,new JSONObject().put("value",cartCookie(d)==null?JSONObject.NULL:cartCookie(d)),null);return;}
    if(type.equals("CART_COOKIE_WRITE")){
      String d=cartDomain(m),v=m.getString("value");validateCartValue(v);String old=cartCookie(d);
      java.util.function.Consumer<String> failure=error->{
        setCartSequence(d,old==null?"":old,0,()->reply(req,null,"Importação falhou; referência anterior restaurada."),restoreError->reply(req,null,"Falha ao importar e restaurar. Confira o carrinho antes de continuar."));
      };
      setCartSequence(d,v,0,()->{try{if(!v.equals(cartCookie(d)))throw new Exception("Cookie não confirmado.");reply(req,new JSONObject().put("saved",true),null);}catch(Exception e){failure.accept(e.getMessage());}},failure);return;
    }
    if(type.startsWith("STORAGE_")){String area=m.optString("area"),key=m.optString("key");boolean local=area.equals("local");
      if(type.equals("STORAGE_GET")){JSONObject out=new JSONObject();Object value=local?getStored(key):session.get(key);if(value!=null)out.put(key,value);reply(req,out,null);return;}
      if(type.equals("STORAGE_SET")){JSONObject values=m.getJSONObject("values"),old=new JSONObject();Iterator<String> keys=values.keys();while(keys.hasNext()){String k=keys.next();Object previous=local?getStored(k):session.get(k);if(previous!=null)old.put(k,previous);if(local)prefs.edit().putString("data_"+k,values.get(k).toString()).commit();else session.put(k,values.get(k));}reply(req,old,null);return;}
      Object old=local?getStored(key):session.remove(key);if(local)prefs.edit().remove("data_"+key).commit();reply(req,old,null);return;
    }
    if(type.equals("TAB_CURRENT")){reply(req,tabInfo(find(target)),null);return;}
    if(type.equals("TAB_GET")){reply(req,tabInfo(find(m.getInt("id"))),null);return;}
    if(type.equals("PANEL_TAB")){showPanel(true);reply(req,new JSONObject().put("id",target),null);return;}
    if(type.equals("PANEL_OVERLAY")){showPanel(false);reply(req,new JSONObject(),null);return;}
    if(type.equals("SAVE_FILE")){if(exportBytes!=null)throw new Exception("Conclua o salvamento anterior.");exportBytes=android.util.Base64.decode(m.getString("data"),android.util.Base64.DEFAULT);exportRequest=req;String name=m.optString("name","divisao.xlsx").replaceAll("[/\\\\]","_");Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(name.endsWith(".xlsx")?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/json");intent.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(intent,12);return;}
    Tab t=find(m.getInt("id"));if(t==null||!liga(t.web.getUrl()))throw new Exception("Abra o carrinho da LigaMagic nesta aba.");
    if(type.equals("RELOAD")){t.web.reload();reply(req,new JSONObject(),null);return;}
    if(type.equals("READ")){if(t.loading)throw new Exception("Aguarde o carrinho carregar.");String js=asset("panel/core.js")+"\n"+asset("panel/reader.js")+"\nJSON.stringify({...LMRead(),documentSession:"+JSONObject.quote(t.document)+"})";t.web.evaluateJavascript(js,result->{try{Object text=new JSONTokener(result).nextValue();if(!(text instanceof String))throw new Exception("Não foi possível ler o carrinho.");reply(req,new JSONObject((String)text),null);}catch(Exception e){reply(req,null,e.getMessage());}});return;}
    if(type.equals("EVAL")){String expr=m.getString("expression");String js="(()=>{try{return JSON.stringify({ok:true,value:("+expr+")});}catch(e){return JSON.stringify({ok:false,error:String(e.message||e)});}})()";t.web.evaluateJavascript(js,result->{try{Object text=new JSONTokener(result).nextValue();JSONObject out=new JSONObject((String)text);reply(req,out.opt("value"),out.optBoolean("ok")?null:out.optString("error"));}catch(Exception e){reply(req,null,"A página mudou durante a operação. Confira o registro.");}});return;}
    throw new Exception("Comando não suportado.");
  }
  Object getStored(String key){String value=prefs.getString("data_"+key,null);if(value==null)return null;try{return new JSONTokener(value).nextValue();}catch(Exception e){return value;}}
  void reply(String id,Object value,String error){try{JSONObject r=new JSONObject().put("ok",error==null);if(error==null)r.put("value",value==null?JSONObject.NULL:value);else r.put("error",error);if(panel!=null)panel.evaluateJavascript("window.__nativeDone("+JSONObject.quote(id)+","+r+")",null);}catch(Exception e){android.util.Log.e("LigaDivisor","reply",e);}}
  protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==11&&upload!=null){upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));upload=null;}if(request==12){try{if(result!=RESULT_OK||data==null)throw new Exception("Salvamento cancelado.");try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(exportBytes);}reply(exportRequest,new JSONObject().put("saved",true),null);toast("Arquivo salvo.");}catch(Exception e){reply(exportRequest,null,e.getMessage());}finally{exportBytes=null;exportRequest=null;}}}
  void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
  protected void onStop(){super.onStop();saveTabs();CookieManager.getInstance().flush();}
  protected void onDestroy(){for(Tab t:tabs)t.web.destroy();if(panel!=null)panel.destroy();super.onDestroy();}
}
