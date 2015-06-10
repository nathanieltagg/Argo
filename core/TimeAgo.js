$(function(){
  // window.setInterval(UpdateTimeAgoElements,2000);
});

function TimeAgoText(t)
{
  var now = new Date;
  var date = new Date(t);    
  var dt = (now.getTime() - date.getTime())/1000.
  var age = dt;
  if(dt<60*2)             age = dt.toFixed(0) + " sec";
  else if(dt<3600*2)      age = (dt/60).toFixed(0) + " min";
  else if(dt<86400*2)     age = (dt/3600).toFixed(1) + " hours";
  else if(dt<24*3600*400) age = (dt/86400).toFixed(1) + " days";
  else                    age = (dt/31536000).toFixed(1) + " years";
  return age + " ago";
}

function UpdateTimeAgoElements()
{
  console.error("Doing update time ago elements");
  $(".TimeAgo").each(function(){
    var t = $(this).data('time');
    if(t) $(this).text(TimeAgoText(t));
  });
}

function CreateTimeAgoElement(timestamp_ms)
{
  return "<span class='TimeAgo' data-time='"+ timestamp_ms +"'>" + TimeAgoText(timestamp_ms) + "</span>";
}
 
