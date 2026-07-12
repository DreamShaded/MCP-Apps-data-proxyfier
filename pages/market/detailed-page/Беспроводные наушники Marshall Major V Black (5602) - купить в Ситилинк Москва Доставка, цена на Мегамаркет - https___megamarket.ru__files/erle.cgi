
(function (ph){
try{
var A = self['DSPCounter' || 'AdriverCounter'],
	a = A(ph);
a.reply = {
ph:ph,
rnd:'132840',
bt:62,
sid:223947,
pz:0,
sz:'product',
bn:0,
sliceid:0,
netid:0,
ntype:0,
tns:0,
pass:'',
adid:0,
bid:2864425,
geoid:38,
cgihref:'//ad.adriver.ru/cgi-bin/click.cgi?sid=223947&ad=0&bid=2864425&bt=62&bn=0&pz=0&xpid=DpJoUuZX36Cqj4JbY5u_uknkgzRMr1rAFFposcobJRkD6Kmy0NcP6Lq_Dr-0ud60IlkIgf2PZHHB_UTOPnyQIq-_XLg&ref=https:%2f%2fmegamarket.ru%2f&custom=128%3D4246.800000000745%3B129%3D1.11.10%3B153%3Dundefined%3B157%3Dclient_id%3B158%3Dany_id%3B10%3D600018869646_99804%3B206%3DDSPCounter',
target:'_blank',
width:'0',
height:'0',
alt:'AdRiver',
mirror:A.httplize('//mlb2.adriver.ru'), 
comp0:'0/script.js',
custom:{"10":"600018869646_99804","128":"4246.800000000745","129":"1.11.10","153":"undefined","157":"client_id","158":"any_id","206":"DSPCounter"},
track_site:0,
cid:'AHl7JH5nUWXKSWDI6JmS_mw',
uid:2581787488293,
xpid:'DpJoUuZX36Cqj4JbY5u_uknkgzRMr1rAFFposcobJRkD6Kmy0NcP6Lq_Dr-0ud60IlkIgf2PZHHB_UTOPnyQIq-_XLg'
}
var r = a.reply;

r.comppath = r.mirror + '/images/0002864/0002864425/' + (/^0\//.test(r.comp0) ? '0/' : '');
r.comp0 = r.comp0.replace(/^0\//,'');
if (r.comp0 == "script.js" && r.adid){
	A.defaultMirror = r.mirror; 
	A.loadScript(r.comppath + r.comp0 + '?v' + ph) 
} else if ("function" === typeof (A.loadComplete)) {
   A.loadComplete(a.reply);
}
}catch(e){} 
}('1'));
