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
  this.element = element;
  var settings = {
    log_y:false
    ,min_u:0
    ,max_u:2.9 // crate*20 + card;
    ,min_v:0
    ,max_v:2.9 // channels
    
  };
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
  this.crate_w = 0.9;
  this.crate_h = 0.9;
  this.card_w = this.crate_w/18;
  this.card_h = this.crate_w-0.05;
  this.chan_w = this.card_w/2.5
  this.chan_h = this.card_h/40;
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  this.Draw();
}



ChannelMap.prototype.NewRecord = function()
{
  this.Draw();
}


ChannelMap.prototype.CrateBox = function(crate)
{
  var cratex = crate%3;
  var cratey = 2-Math.floor(crate/3);
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
  var cardu = card*this.crate_w/16;
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

ChannelMap.prototype.Draw = function()
{
  var cs = new ColorScaleRedBlue;
  ColorScale 
  this.Clear();
  // Crate boxes.
  for(var crate=0;crate<9;crate++) {
    var cratebox = this.CrateBox(crate);
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
    this.ctx.beginPath();    
    this.ctx.moveTo();
    this.ctx.font = "12px sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = "rgba(0,0,0,1)";    
    this.ctx.fillText("Crate "+crate, (cratebox.x1+cratebox.x2)/2, cratebox.y1);
    
    for(var card=0;card<16;card++) {
      var cardbox = this.CardBox(cratebox,card);
      this.ctx.fillStyle = "rgba(0,250,0,0.2)";
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
      this.ctx.beginPath();
      this.ctx.moveTo(cardbox.x1,cardbox.y1);
      this.ctx.lineTo(cardbox.x1,cardbox.y2);
      this.ctx.lineTo(cardbox.x2,cardbox.y2);
      this.ctx.lineTo(cardbox.x2,cardbox.y1);
      this.ctx.lineTo(cardbox.x1,cardbox.y1);
      this.ctx.fill();
      this.ctx.stroke();
      
      for(var chan=0;chan<64;chan++) {
        var chanbox = this.ChannelBox(cardbox,chan);
        var val = Math.random();
        this.ctx.fillStyle = "rgba("+cs.GetColor(val) + ",1)";
        this.ctx.beginPath();    
        this.ctx.moveTo(chanbox.x1,chanbox.y1);
        this.ctx.lineTo(chanbox.x1,chanbox.y2);
        this.ctx.lineTo(chanbox.x2,chanbox.y2);
        this.ctx.lineTo(chanbox.x2,chanbox.y1);
        this.ctx.lineTo(chanbox.x1,chanbox.y1);
        this.ctx.fill();
        this.ctx.stroke();    
        
        // this.ctx.fillRect(chanbox.x1,chanbox.y1,chanbox.x2-chanbox.x1,chanbox.y1-chanbox.y2);
      }
      
    }
  }
  
  
  // this.DrawFrame();


  
}

ChannelMap.prototype.DoMouse = function(ev)
{
}
