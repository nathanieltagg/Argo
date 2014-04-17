//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gChannelMap = null;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-ChannelMap').each(function(){
    gChannelMap = new ChannelMap(this);
  });  
});


// Subclass of HistCanvas.
ChannelMap.prototype = new Pad(null);

function ChannelMap( element, path)
{
  if(element==null) return;
  this.top_element = element;
  this.path = path;  
  $(this.top_element).append("<div class='title' />");
  $(this.top_element).append("<div class='pad main' />");
  this.main_element = $('div.main',this.top_element).get(0);
  $(this.main_element).css("height","600px");
  $(this.main_element).css("width","100%");
  var settings = {
    log_y:false
    ,min_u:0
    ,max_u:2.9 // crate*20 + card;
    ,min_v:0
    ,max_v:3 // channels
    
  };
  this.element = this.main_element;
  Pad.call(this, this.main_element, settings); // Give settings to Pad contructor.
  
  // sub-pad.
  $(this.top_element).append("<div class='pad adjunct' />");
  this.adjunctpad = $('div.adjunct',this.top_element).get(0);
  $(this.adjunctpad).css("float","left");
  $(this.adjunctpad).css("height","150");
  $(this.adjunctpad).css("width","50%");
  
  // Buttons and things.
  var ctl = '\
  <div class="channelmap-radio">\
    <label><input type="radio" value="value" name="channel-map-radio" checked="checked"/>Value</label>\
    <label><input type="radio" value="diff"  name="channel-map-radio"                  />Diff</label>\
  </div>\
  ';
  $(this.top_element).append(ctl);
  this.radios = $('div.channelmap-radio', this.top_element);
  console.warn($("input[value='value']",this.radios));
  $(":radio",this.radios).click(function(e){
    self.ChangeView();
  });
  // info.
  $(this.top_element).append("<div class='infopane' />");
  $(this.top_element).append("<div style='clear:both;' />");
  
  
  this.associate_hist = new HistCanvas(this.adjunctpad,{margin_left:50});
  
  this.crate_w = 0.96;
  this.crate_h = 0.96;
  this.card_w = this.crate_w/19;
  this.card_h = this.crate_h-0.09;
  this.card_fill_h = this.card_h-0.08;
  this.chan_w = this.card_w/2;
  this.chan_h = (this.card_h)/32;
  
  this.hist = new Histogram;
  var self=this;
  // gStateMachine.BindObj('recordChange',this,"NewRecord");

  this.map = null;
  var self = this;  
  
  $(this.element).mousemove(this.DoMouse.bind(this));
  $(this.element).click(this.DoMouse.bind(this));
  this.SetMagnify();
  
  this.mynamespace= "mns" + this.gUniqueIdCounter;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.NewRecord()});  
  $(document).on("OmRefDataRecieved."+this.mynamespace, function(){return self.NewRecord()});  
  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()}); 
  
  gOmData.add(this.path); 
  gRefData.add(this.path);
  
}

ChannelMap.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
  $(document).off("OmRefDataRecieved."+this.mynamespace);
}

ChannelMap.prototype.NewRecord = function()
{
  console.log("NewRecord");
  this.map   = gOmData.getObj(this.path); 
  if(!this.map)return;
  this.refmap= gRefData.getObj(this.path);

  $(".portlet-title",$(this.top_element).parent()).html(this.map.title);

  // $("div.title",this.top_element).html(this.map.title);

  // Need histogram _slightly_ bigger than max_content
  this.hist = new Histogram(50,this.map.min_content,this.map.max_content+(this.map.max_content-this.map.min_content)/50);
  for(var crate=1;crate<10;crate++) {
    for(var card=4;card<20;card++) {      
      for(var channel=0;channel<64;channel++) {
         var ccc = channel + 64*(card + 20*crate);
         this.hist.Fill(this.map.data[ccc]);
      }
    }
  }
  this.cs = new ColorScaler("RedBluePalette");
  this.cs.min = this.map.min_content;
  this.cs.max = this.map.max_content;
  
  if(this.refmap) {
    this.diff_hist = new Histogram(1000,-100,100);
    for(var crate=1;crate<10;crate++) {
      for(var card=4;card<20;card++) {      
        for(var channel=0;channel<64;channel++) {
           var ccc = channel + 64*(card + 20*crate);
           var x = this.map.data[ccc];
           var y = this.refmap.data[ccc];
           var ex = Math.sqrt(x);
           if(this.map.errs) ex = this.map.errs[ccc];
           var ey = Math.sqrt(y);
           if(this.refmap.errs) ey = this.refmap.errs[ccc];
           var diff = x-y;
           var denom = Math.sqrt(ex*ex+ey*ey);
           if(denom<=0) denom = 1;
           var ediff = diff/denom;
           this.diff_hist.Fill(ediff);
        }
      }
    }
  }
  
  var self = this;
  
  this.associate_hist.FinishRangeChange = function(){self.Draw();}
  this.associate_hist.ChangeRange = function(minu,maxu){self.cs.min = minu; self.cs.max = maxu; HistCanvas.prototype.ChangeRange.call(this,minu,maxu);}
  this.ChangeView();
}





ChannelMap.prototype.ChangeView = function()
{
  this.view_state = $(":checked",this.radios).val();
  console.warn(this.view_state);
  
  this.associate_hist.SetLogy(true);
  if(this.view_state=='diff' && this.refmap) {
    this.associate_hist.xlabel = "(Current-Ref)/Sigma";
    this.associate_hist.ylabel = "Num Channels";
    this.associate_hist.min = this.diff_hist.min_x;
    this.associate_hist.max = this.diff_hist.max_x;
    this.associate_hist.SetHist(this.diff_hist,this.cs);
    this.associate_hist.ResetToHist(this.diff_hist); 
  } else {
    this.associate_hist.xlabel = this.map.ylabel || this.map.title;
    this.associate_hist.ylabel = "Num Channels";
    this.associate_hist.min = this.map.min_content;
    this.associate_hist.max = this.map.max_content;
    this.associate_hist.SetHist(this.hist,this.cs);
    this.associate_hist.ResetToHist(this.hist);     
  }
  this.cs.min = this.associate_hist.min;
  this.cs.max = this.associate_hist.max;
  
  this.Draw();
  this.associate_hist.Draw();
  
}


ChannelMap.prototype.CrateBox = function(crate)
{
  var cratex = (crate-1)%3;
  var cratey = 2-Math.floor((crate-1)/3);
  var box = {
    u1: cratex,
    u2: cratex+this.crate_w,
    v1: cratey,
    v2: cratey+this.crate_h};
  box.x1 = this.GetX(box.u1);
  box.x2 = this.GetX(box.u2);
  box.y1 = this.GetY(box.v1);
  box.y2 = this.GetY(box.v2);
  return box;
}

ChannelMap.prototype.CardBox = function(cratebox,card)
{
  var cardu = (card-4)*this.crate_w/16;
  var box = {
     u1: cratebox.u1 + cardu      
    ,u2: cratebox.u1 + cardu + this.card_w
    ,v1: cratebox.v1              
    ,v2: cratebox.v1+ this.card_h };
  box.x1 = this.GetX(box.u1);
  box.x2 = this.GetX(box.u2);
  box.y1 = this.GetY(box.v1);
  box.y2 = this.GetY(box.v2);
  return box;
}

ChannelMap.prototype.ChannelBox = function(cardbox,channel)
{
  var channelu = Math.floor(channel/32) * this.card_w/2;
  var channelv = channel%32 * this.card_fill_h/ 32;
  var box = {
     u1: cardbox.u1 + channelu      
    ,u2: cardbox.u1 + channelu + this.chan_w
    ,v1: cardbox.v1 + channelv              
    ,v2: cardbox.v1 + channelv + this.chan_h 
  };
  box.x1 = this.GetX(box.u1)+0.5;
  box.x2 = this.GetX(box.u2)-0.5;
  box.y1 = this.GetY(box.v1)-0.5;
  box.y2 = this.GetY(box.v2)+0.5;
  return box;
}

ChannelMap.prototype.BoxOverlap = function(a,b)
{
  if(a.u2 < b.u1) return false;
  if(b.u2 < a.u1) return false;
  if(a.v2 < b.v1) return false;
  if(b.v2 < a.v1) return false;
  return true;
}

ChannelMap.prototype.InBox = function(p,b)
{
  
  if((p.u >= b.u1) && (p.u < b.u2)
  &&(p.v >= b.v1) && (p.v < b.v2)) return true;
  return false;
}

ChannelMap.prototype.DrawOne = function(umin,umax,vmin,vmax)
{
  console.timeStamp("ChannelMap.DrawOne()");
  // cs.colorScale= new ColorScaleRedBlue;
  console.log("Drawone");
  if(!this.map) return;

  var do_diff = (this.view_state=='diff' && this.refmap);

  var cs = this.cs;

  var drawbox = {u1:umin,u2:umax,v1:vmin,v2:vmax};
  // cs.min =500;
  // cs.max = 600;
  this.Clear();
  // Crate boxes.
  for(var crate=1;crate<10;crate++) {
    var cratebox = this.CrateBox(crate);
    // Clip for partical draw.
    if(!this.BoxOverlap(drawbox,cratebox)) continue;
    this.ctx.fillStyle = "rgba(250,0,0,0.2)";
    this.ctx.strokeStyle = "rgba(0,0,0,1)";
    this.ctx.beginPath();
    this.ctx.moveTo(cratebox.x1,cratebox.y1);
    this.ctx.lineTo(cratebox.x1,cratebox.y2);
    this.ctx.lineTo(cratebox.x2,cratebox.y2);
    this.ctx.lineTo(cratebox.x2,cratebox.y1);
    this.ctx.lineTo(cratebox.x1,cratebox.y1);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.font = "12px sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = "rgba(0,0,0,1)";    
    this.ctx.fillText("Crate "+crate, (cratebox.x1+cratebox.x2)/2, cratebox.y2);
    
    for(var card=4;card<20;card++) {      
      var cardbox = this.CardBox(cratebox,card);
      this.ctx.fillStyle = "white";
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
      this.ctx.beginPath();
      this.ctx.moveTo(cardbox.x1,cardbox.y1);
      this.ctx.lineTo(cardbox.x1,cardbox.y2);
      this.ctx.lineTo(cardbox.x2,cardbox.y2);
      this.ctx.lineTo(cardbox.x2,cardbox.y1);
      this.ctx.lineTo(cardbox.x1,cardbox.y1);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.font = "11px serif";
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillStyle = "rgba(0,0,0,1)";   
      this.ctx.fillText(card, (cardbox.x1+cardbox.x2)/2, cardbox.y2);
       
      
      for(var chan=0;chan<64;chan++) {
        
        var ccc = chan + 64*(card + 20*crate);
        var x = this.map.data[ccc];
        var val = x;
        if(do_diff) {
          x = this.map.data[ccc];
          var y = this.refmap.data[ccc];
          var ex = Math.sqrt(x);
          if(this.map.errs) ex = this.map.errs[ccc];
          var ey = Math.sqrt(y);
          if(this.refmap.errs) ey = this.refmap.errs[ccc];
          var diff = x-y;
          var denom = Math.sqrt(ex*ex+ey*ey);
          if(denom<=0) denom = 1;
          val = diff/denom;
        }

        if(val>=cs.min && val<=cs.max ) {
          this.ctx.fillStyle = "rgb("+cs.GetColor(val) + ")";
          // if(chan==0) console.log(ccc,val,this.cs.GetColor(val));
          var chanbox = this.ChannelBox(cardbox,chan);
          this.ctx.beginPath();    
          this.ctx.moveTo(chanbox.x1,chanbox.y1);
          this.ctx.lineTo(chanbox.x1,chanbox.y2);
          this.ctx.lineTo(chanbox.x2,chanbox.y2);
          this.ctx.lineTo(chanbox.x2,chanbox.y1);
          this.ctx.lineTo(chanbox.x1,chanbox.y1);
          this.ctx.fill();
          if((crate == this.fMouseInCrate ) 
            && (card == this.fMouseInCard ) 
            && (chan == this.fMouseInChannel) )
           this.ctx.stroke();    
        }
        // this.ctx.fillRect(chanbox.x1,chanbox.y1,chanbox.x2-chanbox.x1,chanbox.y1-chanbox.y2);
      }
      
    }
  }
  
  console.timeStamp("ChannelMap.DrawOne() Finished");
  
  // this.DrawFrame();


  
}

ChannelMap.prototype.DoMouse = function(ev)
{
  var offset = getAbsolutePosition(this.canvas);
  this.fMouseX = ev.pageX - offset.x;
  this.fMouseY = ev.pageY - offset.y;
  this.fMouseU = this.GetU(this.fMouseX);
  this.fMouseV = this.GetV(this.fMouseY);
  console.log(this.fMouseU,this.fMouseV);
  // Find crate
  var p = {u: this.fMouseU, v: this.fMouseV};
  this.fMouseInCrate = null;
  this.fMouseInCard = null;
  this.fMouseInChannel = null;
  for(var crate=1;crate<10;crate++) {
    var cratebox = this.CrateBox(crate);
    if(this.InBox(p,cratebox)) {
      this.fMouseInCrate = crate;
      for(var card=4;card<20;card++) {
        var cardbox = this.CardBox(cratebox,card);
        if(this.InBox(p,cardbox)) {
          this.fMouseInCard = card;
          for(var channel=0;channel<64;channel++) {
            var chanbox = this.ChannelBox(cardbox,channel);
            if(this.InBox(p,chanbox)) {
              this.fMouseInChannel = channel;
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }
  var txt = "";
  if(null!=this.fMouseInCrate) txt += "Crate: " + this.fMouseInCrate + "<br/>";
  if(null!=this.fMouseInCard) txt += "Card: " + this.fMouseInCard + "<br/>";
  if(null!=this.fMouseInChannel) txt += "Channel: " + this.fMouseInChannel + "<br/>";
  var h = this.map;  
  if(this.fMouseInChannel) txt += "Value: " + h.data[this.fMouseInChannel + 64*(this.fMouseInCard + 20*this.fMouseInCrate)] + "<br/>";

  $(".infopane",this.top_element).html(txt);
  console.log(this.fMouseInCrate,this.fMouseInCard,this.fMouseInChannel);
  
  if(ev.type === 'click' && this.fMouseInCrate) {
    var hash = "#tpc/crate"+this.fMouseInCrate;
    if(null!=this.fMouseInCard) hash += "/card" + zeropad(this.fMouseInCard,2);
    if(null!=this.fMouseInChannel) hash += "/chan" + zeropad(this.fMouseInChannel,2);
    console.log("click newhash = ",hash);
    window.location.hash = hash;
  }

}
