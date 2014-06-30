//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

$(function(){
  $('div.A-MCInfo').each(function(){
    var o = new MCInfo(this);
  });  
});

function MCInfo( element )
{
  // console.debug("MCInfo::ctor",element);
  this.fElement = element;
  $(".accordion",this.fElement).accordion({
     collapsible: true
  });
    
  gStateMachine.BindObj("recordChange",this,"NewRecord");

}


  
MCInfo.prototype.NewRecord = function() 
{
  // console.debug("MCInfo::Build()");
  $(".accordion",this.fElement).empty();
  
  var mc = gRecord.mc;
  if(!mc) return;

  var h="";

  var ints = mc.gtruth;
  for(var whichint=0;whichint<ints.length;whichint++) {
    var inter = ints[whichint];
    // console.log(inter.index);
    h += "<h3 interaction='" + whichint+"'>";
    h += "<a href='#' >Interaction " + whichint + "</a></h3>";
    h += "<div>";
    
    //var incE = parseFloat($('incoming4p',inter).text().split(',')[3])/1000.;
    var incE = inter.fProbeP4_fE;
    
    h+="<span>" +  incE.toFixed(3)  + " GeV  " + GetParticle(inter.fProbePDG) +"</span><br/>";

    h+= "<span style='font-size: smaller'>" + InteractionCode[inter.fGint] + "("+inter.fGint+") / " +
        ScatterCode[inter.fGscatter] + "("+inter.fGscatter+")" + "</span>";
    
    
    h += '<table border="0" class="mc-info" >';
    var r1 = '<tr><td width="100px" class="mc-info-caption">';
    var r2 = '</td><td class="mc-info-el">';
    var r3 = '</td></tr>';

    h+= r1 + "Target" + r2 + "<sup>" + inter.ftgtA + "</sup>" + ElementName[inter.ftgtZ] + r3;
    // h+= r1 + "Target Nucleon" + r2 + "<sup>" + GetParticle(inter.tgtNucleon) + r3;
    // h+= r1 + "Process Type" + r2 + inter.processType + r3;
    // h+= r1 + "Inc Particle" + r2 + GetParticle(inter.incomingPDG)  + r3;
    h+= r1 + "Q<sup>2</sup>" + r2 + inter.fgQ2 + r3;
    h+= r1 + "X" + r2 + inter.fgX + r3;
    h+= r1 + "Y" + r2 + inter.fgY + r3;
    h+= r1 + "W" + r2 + inter.fgW + r3;
    //vtx = inter.vtx;
    // h+= r1 + "Vertex (mm)" + r2 + "x:"+Math.round(vtx[0])+ "<br/>"
    //                        + "y:"+Math.round(vtx[1])+ "<br/>"
    //                        + "z:"+Math.round(vtx[2])
    //                        + r3;

    h += '</table>';

    h += "Final State: <br/>";
    var fss = [];
    for(var i =0; i< mc.particles.length; i++) {
      // console.log(mc.particles[i],mc.particles[i].fmother);
      if(mc.particles[i].fmother===0) fss.push(mc.particles[i]);
    }
    h+= "<table border='0' class='mc-fs'>";
    for(var j=0;j<fss.length;j++) {
      var fs = fss[j];
      // Extract and convert to MeV for convenience.
      var px = fs.trajectory[0].px*1000;
      var py = fs.trajectory[0].py*1000;
      var pz = fs.trajectory[0].pz*1000;
      var etot = fs.trajectory[0].E*1000;
      var p2 = px*px + py*py + pz*pz;
      var p  = Math.sqrt(p2);
      var m = fs.fmass*1000;
      var ke = (etot - m);
      h+="<tr>";
      h+="<td class='mc-fs-particle'>" +
        GetParticle(fs.fpdgCode)  +
        "</td><td class='mc-fs-energy'>" +
        '<div class="collapsible-title" data-revealed="false">' +
        "KE=" + ke.toFixed(1) + " MeV"  +
        '</div>' +
        '<div class="collapsible">' +
        "  p=" + p.toFixed(1)  + " MeV/c<br/>" +
        " px=" + px.toFixed(1) + " MeV/c<br/>" +
        " py=" + py.toFixed(1) + " MeV/c<br/>" +
        " pz=" + pz.toFixed(1) + " MeV/c<br/>" +
        " E =" + etot.toFixed(1) + " MeV<br/>" +
        " &theta;: " + (Math.acos(pz/p)*180/Math.PI).toFixed(1) +  "&deg;<br/>" +
        " &phi;:   " + (Math.atan2(py,px)*180/Math.PI).toFixed(1) +  "&deg;<br/>" +
        '</div>' +
        "</td>";
      h+="</tr>";
    }
    h+= "</table>";
    
    h += '</div>';
    
  
  }  
  $(".accordion",this.fElement).html(h);
  make_collapsibles(this.fElement);


  // console.log($(".accordion",this.fElement));
  $(".accordion",this.fElement)
    .accordion("destroy")
    .accordion({collapsible: true})
    .bind('accordionchange', function(event, ui) {	
      console.log("accordian selection: ",ui.newHeader.attr('interaction'));  
      gInteraction = ui.newHeader.attr('interaction');
      gStateMachine.Trigger('selectedMcChange');
      // alert("interaction " + $(ui.newHeader).attr('interaction')); // jQuery object, activated header
    });

};

function overbar(a) { return "<span style='text-decoration: overline'>"+a+"</span>"; }

PdgCodes = [];
PdgCodes[ 1] = "d";
PdgCodes[ 2] = "u";
PdgCodes[ 3] = "s";
PdgCodes[ 4] = "c";
PdgCodes[ 5] = "b";
PdgCodes[ 6] = "t";
PdgCodes[ 7] = "b'";
PdgCodes[ 8] = "t'";
PdgCodes[11] = "e<sup>-</sup>";             PdgCodes[-11] = "e<sup>+</sup>";
PdgCodes[12] = "&nu;<sub>e</sub>";          PdgCodes[-12] = overbar("&nu;")+"<sub>e</sub>";
PdgCodes[13] = "&mu;<sup>-</sup>";          PdgCodes[-13] = "&mu;<sup>+</sup>";
PdgCodes[14] = "&nu;<sub>&mu;</sub>";       PdgCodes[-14] = overbar("&nu;")+"<sub>&mu;</sub>";
PdgCodes[15] = "&tau;<sup>-</sup>";         PdgCodes[-15] = "&tau;<sup>+</sup>";
PdgCodes[16] = "&nu;<sub>&tau;</sub>";      PdgCodes[-16] = overbar("&nu;")+"<sub>&tau;</sub>";

PdgCodes[21] = PdgCodes[-21] = "g";
PdgCodes[22] = PdgCodes[-22] = "&gamma;";
PdgCodes[23] = PdgCodes[-23] = "Z<sup>0</sup>;";
PdgCodes[24] = "W<sup>+</sup>;";            PdgCodes[-24] = "W<sup>-</sup>;";

PdgCodes[211] = "&pi;<sup>+</sup>";        PdgCodes[-211] = "&pi;<sup>-</sup>";
PdgCodes[111] = "&pi;<sup>0</sup>";        PdgCodes[-111] = overbar(PdgCodes[111]);
PdgCodes[321] = "K<sup>+</sup>";           PdgCodes[-321] = "K<sup>-</sup>";
PdgCodes[311] = "K<sup>0</sup>";           PdgCodes[-311] = overbar(PdgCodes[311]);

PdgCodes[221] = "&eta;";                    PdgCodes[-221] = overbar(PdgCodes[221]);

PdgCodes[2112] = "n";                       PdgCodes[-2112] = overbar(PdgCodes[2112]);
PdgCodes[2212] = "p";                       PdgCodes[-2212] = overbar(PdgCodes[2212]);

PdgCodes[3122] = "&Lambda;";                PdgCodes[-3122] = overbar(PdgCodes[3122]);
PdgCodes[3112] = "&Sigma;<sup>-</sup>";
PdgCodes[3222] = "&Sigma;<sup>+</sup>";
PdgCodes[3212] = "&Sigma;<sup>0</sup>";

PdgCodes[-3112] = overbar("&Sigma;")+"<sup>+</sup>";
PdgCodes[-3222] = overbar("&Sigma;")+"<sup>-</sup>";
PdgCodes[-3212] = overbar("&Sigma;")+"<sup>0</sup>";

PdgCodes[3322] = "&Xi;<sup>0</sup>";        PdgCodes[-3322] = overbar(PdgCodes[3322]);
PdgCodes[3312] = "&Xi;<sup>-</sup>";        PdgCodes[-3312] = overbar(PdgCodes[3312]);
PdgCodes[3334] = "&Omega;<sup>-</sup>";     PdgCodes[-3334] = "&Omega;<sup>+</sup>";  



ElementName = [];

ElementName[0  ] = "X";
ElementName[1  ] = "H";
ElementName[2  ] = "He";
ElementName[3  ] = "Li";
ElementName[4  ] = "Be";
ElementName[5  ] = "B";
ElementName[6  ] = "C";
ElementName[7  ] = "N";
ElementName[8  ] = "O";
ElementName[9  ] = "F";
ElementName[10 ] = "Ne";
ElementName[11 ] = "Na";
ElementName[12 ] = "Mg";
ElementName[13 ] = "Al";
ElementName[14 ] = "Si";
ElementName[15 ] = "P";
ElementName[16 ] = "S";
ElementName[17 ] = "Cl";
ElementName[18 ] = "Ar";
ElementName[19 ] = "K";
ElementName[20 ] = "Ca";
ElementName[21 ] = "Sc";
ElementName[22 ] = "Ti";
ElementName[23 ] = "V";
ElementName[24 ] = "Cr";
ElementName[25 ] = "Mn";
ElementName[26 ] = "Fe";
ElementName[27 ] = "Co";
ElementName[28 ] = "Ni";
ElementName[29 ] = "Cu";
ElementName[30 ] = "Zn";
ElementName[31 ] = "Ga";
ElementName[32 ] = "Ge";
ElementName[33 ] = "As";
ElementName[34 ] = "Se";
ElementName[35 ] = "Br";
ElementName[36 ] = "Kr";
ElementName[37 ] = "Rb";
ElementName[38 ] = "Sr";
ElementName[39 ] = "Y";
ElementName[40 ] = "Zr";
ElementName[41 ] = "Nb";
ElementName[42 ] = "Mo";
ElementName[43 ] = "Tc";
ElementName[44 ] = "Ru";
ElementName[45 ] = "Rh";
ElementName[46 ] = "Pd";
ElementName[47 ] = "Ag";
ElementName[48 ] = "Cd";
ElementName[49 ] = "In";
ElementName[50 ] = "Sn";
ElementName[51 ] = "Sb";
ElementName[52 ] = "Te";
ElementName[53 ] = "I";
ElementName[54 ] = "Xe";
ElementName[55 ] = "Cs";
ElementName[56 ] = "Ba";
ElementName[57 ] = "La";
ElementName[58 ] = "Ce";
ElementName[59 ] = "Pr";
ElementName[60 ] = "Nd";
ElementName[61 ] = "Pm";
ElementName[62 ] = "Sm";
ElementName[63 ] = "Eu";
ElementName[64 ] = "Gd";
ElementName[65 ] = "Tb";
ElementName[66 ] = "Dy";
ElementName[67 ] = "Ho";
ElementName[68 ] = "Er";
ElementName[69 ] = "Tm";
ElementName[70 ] = "Yb";
ElementName[71 ] = "Lu";
ElementName[72 ] = "Hf";
ElementName[73 ] = "Ta";
ElementName[74 ] = "W";
ElementName[75 ] = "Re";
ElementName[76 ] = "Os";
ElementName[77 ] = "Ir";
ElementName[78 ] = "Pt";
ElementName[79 ] = "Au";
ElementName[80 ] = "Hg";
ElementName[81 ] = "Tl";
ElementName[82 ] = "Pb";
ElementName[83 ] = "Bi";
ElementName[84 ] = "Po";
ElementName[85 ] = "At";
ElementName[86 ] = "Rn";
ElementName[87 ] = "Fr";
ElementName[88 ] = "Ra";
ElementName[89 ] = "Ac";
ElementName[90 ] = "Th";
ElementName[91 ] = "Pa";
ElementName[92 ] = "U";
ElementName[93 ] = "Np";
ElementName[94 ] = "Pu";
ElementName[95 ] = "Am";
ElementName[96 ] = "Cm";
ElementName[97 ] = "Bk";
ElementName[98 ] = "Cf";
ElementName[99 ] = "Es";
ElementName[100] = "Fm";
ElementName[101] = "Md";
ElementName[102] = "No";
ElementName[103] = "Lr";
ElementName[104] = "Rf";
ElementName[105] = "Db";
ElementName[106] = "Sg";
ElementName[107] = "Bh";
ElementName[108] = "Hs";
ElementName[109] = "Mt";


ChannelCode = [];
ChannelCode[0] = "No interaction";
ChannelCode[1] = "QE";
ChannelCode[2] = "Res";
ChannelCode[3] = "DIS";
ChannelCode[4] = "Coh &pi;";
ChannelCode[5] = "AMNUGAMMA";
ChannelCode[6] = "Inv &mu; decay";
ChannelCode[7] = "&nu<sub>e</sub> elastic";
ChannelCode[8] = "Unknown";

CurrentCode = [];
CurrentCode[1] = "CC";
CurrentCode[2] = "NC";

// Genie codes.
InteractionCode = [];
InteractionCode[0] ="Null";
InteractionCode[1] ="EM";
InteractionCode[2] ="CC";
InteractionCode[3] ="NC";
InteractionCode[4] ="WeakMix";
InteractionCode[5] ="NDecay";

ScatterCode = []; 
ScatterCode[0] =   "Null";
ScatterCode[1] =   "Quasi-elastic";
ScatterCode[2] =   "Deep Inelastic";
ScatterCode[3] =   "Resonant";
ScatterCode[4] =   "Coherent";
ScatterCode[5] =   "Diffractive";
ScatterCode[6] =   "NuElectronElastic";
ScatterCode[7] =   "InverseMuDecay";
ScatterCode[8] =   "AMNuGamma";
ScatterCode[9] =   "MEC";
ScatterCode[10] =  "Coherent Elastic";
ScatterCode[11] =  "InverseBetaDecay";
ScatterCode[12] =  "GlashowResonanc";


function GetParticle(code)
{
  ///
  /// Transform a PDG code into something printable.
  ///
  var p = PdgCodes[code];
  if(p) return p;
  // googled from geant4 code, seems consistent with the picture.
  // Nuclear codes are given as 10-digit numbers +-10LZZZAAAI.
   //For a nucleus consisting of np protons and nn neutrons
   // A = np + nn +nlambda and Z = np.
   // L = nlambda
   // I gives the isomer level, with I = 0 corresponding 
   // to the ground state and I >0 to excitations
   if(code > 1000000000) {
     var I = code%10;
     var A = Math.floor(code/10)%1000;
     var Z = Math.floor(code/10000)%1000;
     var el = ElementName[Z];
     if(el === undefined) el = Z;
     p = "<sup>"+A+"</sup>"+el;
     if(I>0) p += "<sup>*</sup>";
     return p;
   }
  
  console.log("Can't find lookup code for ",code);
  return code;
}

