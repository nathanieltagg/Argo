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

ArgoServerTools::setup();

# - Look for the most recent event in the cache. Serve it, along with heartbeat data.
# - If the event is old,
# -   if the heartbeat is old
# -      re-start the live event server.


# look at the available cached files.
@cacheentries = glob("$cache_dir/*.event");
# Sort by filename
@cacheentries = reverse sort @cacheentries;
for $f (@cacheentries) {
  print $f . "\n";
}

$most_recent_event = $cacheentries[0];
my $event = $most_recent_event;   #default: go for the most up-to-date.


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
$result .= ",\"live_cache_file\":\"" . $event . "\"";

if( -r "$cache_dir/heartbeat.json") {
  open(HEARTBEAT,"$cache_dir/heartbeat.json") || print "Can't open heartbeat for reading </br>\n";
  $heartbeat = "";
  while(<HEARTBEAT>) {
    $heartbeat .= $_;
  }
  close HEARTBEAT;    
  $result .= ",\"heartbeat\":" . $heartbeat;
}
ArgoServerTools::serve($result);
#
# #
# # This variant attempts to get the most recent gate from neartime-processed DSTs
# #
# my $start_time = Time::HiRes::gettimeofday();
#
#
# $ArgoServerTools::ntuple_server_port = 9093;
# $ArgoServerTools::ntuple_server_host = 'localhost';
# $ArgoServerTools::exec_name = 'argo-raw-backend';
#
# ArgoServerTo./ols::setup();
# open(PROFLOG,">>serve_live_event_profile.log");
#
# # look at the available cached files.
# @cacheentries = glob("live_event_cache/*.event");
# # Sort by filename
# @cacheentries = reverse sort @cacheentries;
# for $f (@cacheentries) {
#   print $f . "\n";
# }
#
# $most_recent_event = @\$cacheentries[0];
# my $event = $most_recent_event;   #default: go for the most up-to-date.
#
#
# # Check request params.
# if(defined param('latest_cache') && defined param('recent_cache')) {
#   $latest_cache = param('latest_cache');   #timestamp of the latest event yet seen by that client
#   $recent_cache = param('recent_cache'); #timestamp of the event they were just looking at.
#   # Has a new event come along since we last looked?
#   if($most_recent_event gt $latest_cache) {
#       $event = $most_recent_event;
#     } else {
#       print "Found no fresh event. Moving on to the next-most-stale-event from $recent_cache<br/>\n";
#       # Ok, nothing fresh. Find the next-most-stale event.
#       for $f (@cacheentries) {
#         print "Looking at $f<br/>\n";
#         if($f lt $recent_cache) {
#           print "Found stale file $f<br/>\n";
#           $event = $f; last;
#         }
#       }
#     }
#
# } else {
#   #Return most recent file.
#   print "Simple method: serving most recent cache file: $event</br>\n";
# }
#
# open(READCACHE,"<$event/event.json") || print "Can't open $event/event.json for reading </br>\n";
# $result = "";
# while(<READCACHE>) {
#   $result .= $_;
# }
# close READCACHE;
#
# my $download=0;
# if(defined param('download')) { $download = 1; }
# $result .= ",\"live_cache_file\":\"" . $event . "\"";
#
# ArgoServerTools::serve($result,$download);
#
# #remove old log files, more than 1/2 day old.
# for ( glob "argo_backend*.log" ) {
#   unlink $_ if ( -M $_ > 0.5 );
# }
