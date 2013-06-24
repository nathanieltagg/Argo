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
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()}); 
  
  gOmData.add(this.path); 
}

ChannelMap.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
}

ChannelMap.prototype.NewRecord = function()
{
  console.log("NewRecord");
  this.map = null;
  if(!gOmData.data) return;
  if(!gOmData.data.record) return;
  if(!gOmData.data.record[this.path]) return;
  if(!gOmData.data.record[this.path].data) return;
  this.map= gOmData.data.record[this.path].data;

  $("div.title",this.top_element).html(this.map.title);

  this.hist = new Histogram(50,this.map.min_content,this.map.max_content);
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
  this.associate_hist.xlabel = this.map.ylabel || this.map.title;
  this.associate_hist.ylabel = "Num Channels";
  this.associate_hist.tick_pixels_x =60;
  this.associate_hist.min = this.map.min_content;
  this.associate_hist.max = this.map.max_content;
  this.associate_hist.SetHist(this.hist,this.cs);
  this.associate_hist.ResetToHist(this.hist);
  var self = this;
  this.associate_hist.FinishRangeChange = function(){self.Draw();}
  this.associate_hist.ChangeRange = function(minu,maxu){self.cs.min = minu; self.cs.max = maxu; HistCanvas.prototype.ChangeRange.call(this,minu,maxu);}
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
        var val = this.map.data[ccc];
        // var val = Math.random();

        if(val>=this.cs.min && val<=this.cs.max ) {
          this.ctx.fillStyle = "rgb("+this.cs.GetColor(val) + ")";
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
          for(var channel=0;channel<63;channel++) {
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
  if(this.fMouseInCrate) txt += "Crate: " + this.fMouseInCrate + "<br/>";
  if(this.fMouseInCard) txt += "Card: " + this.fMouseInCard + "<br/>";
  if(this.fMouseInChannel) txt += "Channel: " + this.fMouseInChannel + "<br/>";
  var h = gOmData.data.record[this.path].data;  
  if(this.fMouseInChannel) txt += "Value: " + h.data[this.fMouseInChannel + 64*(this.fMouseInCard + 20*this.fMouseInCrate)] + "<br/>";

  $(".infopane",this.top_element).html(txt);
  console.log(this.fMouseInCrate,this.fMouseInCard,this.fMouseInChannel);
  
  if(ev.type === 'click' && this.fMouseInCrate) {
    var hash = "#tpc/crate"+this.fMouseInCrate;
    if(this.fMouseInCard) hash += "/crate"+this.fMouseInCrate + "card" + zeropad(this.fMouseInCard,2);
    if(this.fMouseInChannel) hash += "/crate"+this.fMouseInCrate + "card" + zeropad(this.fMouseInCard,2) + "chan" + zeropad(this.fMouseInChannel,2);
    console.log("click newhash = ",hash);
    window.location.hash = hash;
  }

}
