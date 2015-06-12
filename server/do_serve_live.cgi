#!/usr/bin/perl -w

use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use File::Spec;
use URI::Escape;
use ArgoServerTools qw(setup myerror);

#configuration
# $updater_exec = 'argo-live-backend';
$cache_dir = '../live_event_cache';
$heartbeat_timeout = 40; #seconds
$heartbeat_file = "$cache_dir/heartbeat.json";

ArgoServerTools::setup();

$ArgoServerTools::exec_name = "argo-live-backend";
$ArgoServerTools::exec_arguments = "../server/live.config";

# First, check the server heartbeat.
$heartbeat_time = 0;
$heartbeat = "{}";

$need_to_restart = 0;
if( -r  $heartbeat_file) {
  # Get heartbeat contents.
  open(HEARTBEAT,$heartbeat_file) || print "Can't open heartbeat for reading </br>\n";
  $heartbeat = "";
  while(<HEARTBEAT>) {
    $heartbeat .= $_;
  }
  close HEARTBEAT;    

  # When was the heartbeat last updated? 
  $heartbeat_time = (stat($heartbeat_file))[9];
  $oldness = (time() - $heartbeat_time);
  print "Heartbeat file is $oldness seconds old.";
  if( $oldness > $heartbeat_timeout) {
    # It's too old!  
    print "Heartbeat file is too old!  Need server restart.";
    $need_to_restart = 1;
   }
  
} else {
  $need_to_restart = 1;  # Heartbeat file not updated.
  print "No heartbeat file. Need to restart."
}


print "Looking at cache....\n";
$event = undef;

# look at the available cached files.
@cacheentries = glob("$cache_dir/*.event");
# Sort by filename
@cacheentries = reverse sort @cacheentries;
for $f (@cacheentries) {
  print $f . "\n";
}
  
if(scalar @cacheentries == 0) {
  $result = '{"error":"No entries in cache."}';

} else {
  # There's something in the cache, so look through and pick the best one.
  
  $most_recent_event = $cacheentries[0];
  $event = $most_recent_event;   #default: go for the most up-to-date.


  # Check request params.
  if(defined param('latest_cache') && defined param('recent_cache')) {
    $latest_cache = param('latest_cache'); #ID of the latest event yet seen by that client
    $recent_cache = param('recent_cache'); #ID of the event they were just looking at.
    # Has a new event come along since we last looked?
    if($most_recent_event gt $latest_cache) {
        $event = $most_recent_event;
      } else {
        print "Found no fresh event. Moving on to the next-most-stale-event from $recent_cache<br/>\n";
        # Ok, nothing fresh. Find the next-most-stale event.
        for $f (@cacheentries) {
          print "Looking at $f<br/>\n";
          if($f lt $recent_cache) {
            print "Found stale file $f<br/>\n";
            $event = $f; last;
          }
        }
      }
  }

  open(READCACHE,$event."/event.json") || print "Can't open $event for reading </br>\n";
  $result = "";
  while(<READCACHE>) {
    $result .= $_;
  }
  close READCACHE;

} 


if(defined $event) { $result .= ",\"live_cache_file\":\"" . $event . "\""; }
$result .= ",\"heartbeat\":" . $heartbeat . ",\"heartbeat_time\":" . $heartbeat_time;
  


if($need_to_restart>0) {
  print "Restarting the server.";
  # Touch the heartbeat file to make sure that no other script tries to do this at the same time,
  # leading to even more logjams.
  if ( open(HEARTBEAT,">$heartbeat_file") ) {
    print HEARTBEAT "{ \"server_restart\": "
    . time()
    . "}";
    close HEARTBEAT;    
  }
  

  # First, kill any running process in case it's log-jammed.
  print "Killing old server.<br>\n";
  ArgoServerTools::kill_running_server();
  
  # Then, spawn off a new process.
  print "Starting new server.<br>\n";
  ArgoServerTools::start_server();
}

ArgoServerTools::serve($result);

