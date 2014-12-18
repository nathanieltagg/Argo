#!/usr/bin/perl -w
package update_live_cache;

use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use ArgoServerTools;
use JSON::XS qw(decode_json encode_json);
use Data::Dumper;


#
# Script to get update the JSON cache.
# 

# Configuration:

our $fastest_update_allowed = 5; #seconds
our $update_stamp_file = "live_last_update.stamp";
our $cache_dir = "./live_event_cache";
our $max_cache = 20;


sub update
{
  # Don't run this script more often than once every few seconds. This keeps many many 'live' servers from clobbering the back-end.
  if(-r $update_stamp_file) {
    $t = (stat($update_stamp_file))[9];
    if((time() - $t) < $fastest_update_allowed) {
      print "Throttling cache update<br/>\n";
    }
  }
  if(count_cache() < $max_cache)
  {
    seed_cache();
  } else {
    print "Looking for a fresh event. <br/>/n";
    pull_to_cache();   #pull an event.
  }
  
  clean_cache();  # remove old files
  system("touch $update_stamp_file");
}

sub count_cache
{
  my @cachefiles = glob("$cache_dir/*.event");
  my $num = scalar(@cachefiles);  
  print "count_cache: $num<br/>\n";
  return $num;
}

sub pull_to_cache  # filename, entrystart
{
  # Go get a specified event. If it hasn't already been put into the cache, put it there.
  #
  my $event = shift || $live_dst;
  my $entryStart = shift || -1;
  
  # See if there's a new event in the live file.
  my $options = "+REFRESH";
  my $selection = "n_idhits>30";
  my $entryEnd   = 0;
  print "Requesting $filename selection:$selection, start:$entryStart end:$entryEnd, options:$options</br>\n";
  #
  $result = ArachneServerTools::request($filename,$selection,$entryStart,$entryEnd,$options);
  # Get required data from result.

  my $run=0;
  my $subrun=0;
  my $gate=0;
  $record = decode_json $result;
  # print Dumper($record);
  print "Examining...\n";
  if( exists($record->{'ev'}) ) {
    # looks like a real result.
    $run = $record->{'ev'}->{'run'};
    $subrun = $record->{'ev'}->{'sub_run'};
    $gate = $record->{'ev'}->{'gate'};

    # save the result only if it's not already there.
    $cachefilename = sprintf("$cache_dir/cache_%08d_%04d_%012d.json",$run,$subrun,$gate);
    if(! -r "$cachefilename" ) {
      open(CACHEFILE,">$cachefilename") || die "Couldn't open $cachefilename\n";
      print CACHEFILE $result;
      close CACHEFILE;
      print "Saved file $cachefilename<br>/\n";
      return 0;  # pulled a good file.
    }
    print "No new event in file.\n<br/>";
    return 1; # no new event in file
  }

  print "No good events in file.\n<br/>";
  return 2; # no good events in file.
}


sub clean_cache
{
  my @cachefiles = glob("$cache_dir/cache*.json");
  my $n = scalar(@cachefiles);
  while($n > $max_cache) {
    my $file = shift @cachefiles;
    unlink $file;
    $n--;
  }  
} 


sub seed_cache()
{
  # count how many files we need.
  # Go through the seed_glob_list one at a time, looking for valid files.
  system("mkdir -p $cache_dir");

  my $n = $max_cache - count_cache();  #number still needed.
  print "Seeding cache: need $n files.</br>\n";

  for $g (@seed_glob_list) {

    my @files = glob($g);
    my %modtime;
    foreach $file (@files) {
      $modtime{$file} = ((stat($file))[9] || 0);  # the || guards against a nonexistant file
    }
    #find file with most recent modtime
    @files = sort {$modtime{$a} <=> $modtime{$b}} @files;
    @files = reverse(@files);
    for $most_recent_filename (@files) {
      print "Seeding cache: need $n files, trying file $most_recent_filename</br>\n";
      foreach my $i (1..$n) {
        pull_to_cache($most_recent_filename,(0-$i)); # pull the last $n events, if they're there.
      }
     
      my $n = $max_cache - count_cache();  #number still needed.
      if ($n<=0) { return; };      
    }
  }
}

