#!/usr/bin/perl -w

use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use File::Spec;
use URI::Escape;
use update_live_cache;
use ArgoServerTools;

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This variant attempts to get the most recent gate from neartime-processed DSTs
#
my $start_time = Time::HiRes::gettimeofday();


$ArgoServerTools::ntuple_server_port = 9093;
$ArgoServerTools::ntuple_server_host = 'localhost';
$ArgoServerTools::exec_name = 'argo-raw-backend';

ArgoServerTools::setup();
open(PROFLOG,">>serve_live_event_profile.log");

# look at the available cached files.
@cacheentries = glob("live_event_cache/*.event");
# Sort by filename
@cacheentries = reverse sort @cacheentries;
for $f (@cacheentries) {
  print $f . "\n";
}

$most_recent_event = @\$cacheentries[0];
my $event = $most_recent_event;   #default: go for the most up-to-date.


# Check request params.
if(defined param('latest_cache') && defined param('recent_cache')) {
  $latest_cache = param('latest_cache');   #timestamp of the latest event yet seen by that client
  $recent_cache = param('recent_cache'); #timestamp of the event they were just looking at.
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
  
} else {
  #Return most recent file.
  print "Simple method: serving most recent cache file: $event</br>\n";
}

open(READCACHE,"<$event/event.json") || print "Can't open $event/event.json for reading </br>\n";
$result = "";
while(<READCACHE>) {
  $result .= $_;
}
close READCACHE;

my $download=0;
if(defined param('download')) { $download = 1; }
$result .= ",\"live_cache_file\":\"" . $event . "\"";

ArgoServerTools::serve($result,$download);

#remove old log files, more than 1/2 day old.
for ( glob "argo_backend*.log" ) {
  unlink $_ if ( -M $_ > 0.5 );
}
