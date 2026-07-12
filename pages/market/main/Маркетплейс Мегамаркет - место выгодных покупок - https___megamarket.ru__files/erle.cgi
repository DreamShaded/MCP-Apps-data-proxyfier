
(function (ph){
try{
var A = self['DSPCounter' || 'AdriverCounter'],
	a = A(ph);
a.reply = {
ph:ph,
rnd:'536901',
bt:62,
sid:223947,
pz:0,
sz:'%2f',
bn:0,
sliceid:0,
netid:0,
ntype:0,
tns:0,
pass:'',
adid:0,
bid:2864425,
geoid:38,
cgihref:'//ad.adriver.ru/cgi-bin/click.cgi?sid=223947&ad=0&bid=2864425&bt=62&bn=0&pz=0&xpid=DcWKJA61AHCuzpE_x5fcpyiOT95RLw3EjKvQ_Mllo7W5GZhgC1JlsfFh5RGWr4ZMD5LvZMrczDqalhKOM&ref=https:%2f%2fmegamarket.ru%2f&custom=128%3D4078.10000000149%3B129%3D1.11.10%3B153%3Dundefined%3B157%3Dclient_id%3B158%3Dany_id%3B206%3DDSPCounter',
target:'_blank',
width:'0',
height:'0',
alt:'AdRiver',
mirror:A.httplize('//servers5.adriver.ru'), 
comp0:'0/script.js',
custom:{"128":"4078.10000000149","129":"1.11.10","153":"undefined","157":"client_id","158":"any_id","206":"DSPCounter"},
track_site:0,
cid:'',
uid:0,
xpid:'DcWKJA61AHCuzpE_x5fcpyiOT95RLw3EjKvQ_Mllo7W5GZhgC1JlsfFh5RGWr4ZMD5LvZMrczDqalhKOM'
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
}('0'));
