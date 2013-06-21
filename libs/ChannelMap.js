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

function ChannelMap( element  )
{
  if(element==null) return;
  this.top_element = element;
  $(this.top_element).append("<h1>Pedestal RMS</h1>");
  
  $(this.top_element).append("<div class='pad main' />");
  this.main_element = $('div.main',this.element).get(0);
  $(this.main_element).css("height","500px");
  $(this.main_element).css("width","100%");
  var settings = {
    log_y:false
    ,min_u:0
    ,max_u:2.9 // crate*20 + card;
    ,min_v:0
    ,max_v:3 // channels
    
  };
  Pad.call(this, this.main_element, settings); // Give settings to Pad contructor.
  
  
  // sub-pad.
  $(this.top_element).append("<div class='pad adjunct' />");
  this.adjunctpad = $('div.adjunct',this.top_element).get(0);
  $(this.adjunctpad).css("height","150");
  $(this.adjunctpad).css("width","50%");
  
  this.associate_hist = new HistCanvas(this.adjunctpad,{margin_left:50});
  
  this.crate_w = 0.9;
  this.crate_h = 0.9;
  this.card_w = this.crate_w/18;
  this.card_h = this.crate_w-0.1;
  this.chan_w = this.card_w/2.5
  this.chan_h = this.card_h/40;
  
  this.hist = new Histogram;
  var self=this;
  // gStateMachine.BindObj('recordChange',this,"NewRecord");

  this.SetMagnify();
  $(this.element).mousemove(this.DoMouse.bind(this));
  $(this.element).click(this.DoMouse.bind(this));
  this.omdata = new OmDataObj("tpc/mapccc/h_pedestal_width");
  this.omdata.callback_newdata = function(){self.NewRecord()};
  this.omdata.get();

}



ChannelMap.prototype.NewRecord = function()
{
  console.log("NewRecord");
  var h= this.omdata.data.record["tpc/mapccc/h_pedestal_width"].data;
  this.hist = new Histogram(50,h.min_content,h.max_content);
  for(var crate=1;crate<10;crate++) {
    for(var card=4;card<20;card++) {      
      for(var channel=0;channel<64;channel++) {
         var ccc = channel + 64*(card + 20*crate);
         this.hist.Fill(h.data[ccc]);
      }
    }
  }
  this.cs = new ColorScaler("RedBluePalette");
  this.cs.min = h.min_content;
  this.cs.max = h.max_content;
  this.associate_hist.xlabel = h.xlabel;
  this.associate_hist.ylabel = "Num Channels";
  this.associate_hist.min = h.min_content;
  this.associate_hist.max = h.max_content;
  this.associate_hist.SetHist(this.hist,this.cs);
  this.associate_hist.ResetToHist(this.hist);
  var self = this;
  this.associate_hist.FinishRangeChange = function(){self.Draw();}
  this.associate_hist.ChangeRange = function(minu,maxu){self.cs.min = minu; self.cs.max = maxu; HistCanvas.prototype.ChangeRange.call(this,minu,maxu);}
  this.Draw();
  
}


ChannelMap.prototype.CrateBox = function(crate)
{
  var cratex = (crate-1)%3;
  var cratey = 2-Math.floor((crate-1)/3);
  return {
    u1: cratex,
    u2: cratex+this.crate_w,
    v1: cratey,
    v2: cratey+this.crate_h,
    x1: this.GetX(cratex),
    x2: this.GetX(cratex+this.crate_w),
    y1: this.GetY(cratey),
    y2: this.GetY(cratey+this.crate_h),
  }
}

ChannelMap.prototype.CardBox = function(cratebox,card)
{
  var cardu = (card-4)*this.crate_w/16;
  return {
     u1: cratebox.u1 + cardu      
    ,u2: cratebox.u1 + cardu + this.card_w
    ,v1: cratebox.v1              
    ,v2: cratebox.v1+ this.card_h 
    ,x1: this.GetX( cratebox.u1 + cardu       )
    ,x2: this.GetX( cratebox.u1 + cardu + this.card_w )
    ,y1: this.GetY( cratebox.v1               )
    ,y2: this.GetY( cratebox.v1+ this.card_h  )
  }
}

ChannelMap.prototype.ChannelBox = function(cardbox,channel)
{
  var channelu = Math.floor(channel/32) * this.card_w/2;
  var channelv = channel%32 * this.card_h/ 32;
  return {
     u1: cardbox.u1 + channelu      
    ,u2: cardbox.u1 + channelu + this.chan_w
    ,v1: cardbox.v1 + channelv              
    ,v2: cardbox.v1 + channelv + this.chan_h 
    ,x1: this.GetX( cardbox.u1 + channelu                  )
    ,x2: this.GetX( cardbox.u1 + channelu + this.chan_w )
    ,y1: this.GetY( cardbox.v1 + channelv                  )
    ,y2: this.GetY( cardbox.v1 + channelv + this.chan_h )
  }
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
  // cs.colorScale= new ColorScaleRedBlue;
  console.log(this.omdata.data);
  if(!this.omdata.data) return;
  var h = this.omdata.data.record["tpc/mapccc/h_pedestal_width"].data;

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
    this.ctx.textBaseline = 'bottom';
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
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillStyle = "rgba(0,0,0,1)";   
      this.ctx.fillText(card, (cardbox.x1+cardbox.x2)/2, cardbox.y2);
       
      
      for(var chan=0;chan<64;chan++) {
        var chanbox = this.ChannelBox(cardbox,chan);
        
        var ccc = chan + 64*(card + 20*crate);
        var val = h.data[ccc];
        // var val = Math.random();

        if(val>=this.cs.min && val<=this.cs.max ) {
          this.ctx.fillStyle = "rgb("+this.cs.GetColor(val) + ")";
          // if(chan==0) console.log(ccc,val,this.cs.GetColor(val));
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
  console.log(this.fMouseInCrate,this.fMouseInCard,this.fMouseInChannel);
  
  if(ev.type === 'click') {
    alert(this.fMouseInCrate+"/"+this.fMouseInCard+"/"+this.fMouseInChannel);
  }

}
