#!/usr/bin/perl -w

use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use ArachneServerTools;

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This variant attempts to get the most recent gate from neartime-processed DSTs
#



# defaults of configuration
#$data_glob = "/minerva/data/users/minerva/data_processing/dst/*_DST*.root ./*DST*.root";
$data_glob = 
  "/minerva/data/online_processing/swap_area/NearlineCurrentNumibDST.root "
. "/minerva/data/online_processing/swap_area/*_numi*DST.root "
. "/minerva/data/users/minerva/data_processing/dst/*_DST*.root "
. "/minerva/data/data_processing/minerva/dst/numip/v7r5p1_DEV_20100724/*/*/*/*/*_DST*.root "
. "./*_DST*.root";

$max_event_duration = 50.0; #seconds

print header(-type => 'text/xml',
             -Access_Control_Allow_Origin => "*");
print '<?xml version="1.0" encoding="ISO-8859-1"?>';
print "<serving>";
print "<serve_event_logging><![CDATA[";

if( -r "server_config.pl" ) {
    require "server_config.pl";
}  


@rawfiles = glob($data_glob);

@files=();
foreach $file (@rawfiles)
{
  if( $file=~/Linjc/ ) { next; }
  push @files,$file;
}

# find mod times.
foreach $file (@files) {
  $modtime{$file} = ((stat($file))[9] || 0);  # the || guards against a nonexistant file
  # print $file . "  " . ((stat($file))[9] || 0) . "\n";
}

#Find file with highest run number.
#@files = sort @files;
#$filename = $files[-1];

#find file with most recent modtime
@files = sort {$modtime{$a} <=> $modtime{$b}} @files;
@files = reverse(@files);


for $most_recent_filename (@files)
{
  print "Checking $most_recent_filename for recent data.\n";
  #print join(":\n",@files);
  $most_recent_mtime = $modtime{$most_recent_filename};


  #default: get the most recent event.
  $entryStart = -1;
  $entryEnd = 0;
  $gate_first_served = time();

  if(open(LASTFILE,"<live_file.txt")) {
    @last = split(';',<LASTFILE>);
    print "Last live event coordinates:\n";
    print join("\n",@last);
    $last_filename = $last[0]; # the name of the last file we served.
    $last_mtime    = $last[1]; # the modification time of the file when we last looked at it
    $last_entry    = $last[2]; # the last entry we've looked at
    $last_served   = $last[3]; # first time that last_entry was served

    if(($last_filename eq $most_recent_filename)  
        && ($last_mtime eq $most_recent_mtime)) 
        {
          # The file has not changed since we last looked
          $event_duration = time()-$last_served;
          print "\n\nFile has not changed. Current event duration: $event_duration\n";
          if($event_duration > $max_event_duration){
            # we need to pick a new event now.
            print "Picking new event.\n";
            $entryStart = $last_entry-1;  # go back one. If in fact this goes to -1, that's ok: that just loops to the end of the file again!
            $entryEnd = 0;
            $gate_first_served = time();
          } else {
            # use the same entry as last time: no change in event.
            print "Using old event.\n";
            $entryStart = $last_entry;
            $entryEnd = 0;
            $gate_first_served = $last_served;
          }
        
    } else {
      print "\nFile $most_recent_filename was recently updated at time $most_recent_mtime, assuming it's the best result.\n";
    }
      
    close(LASTFILE);
  }

  my $options = "+REFRESH";
  print "Requesting $most_recent_filename selection:1, start:$entryStart end:$entryEnd, options:$options\n";
  $result = ArachneServerTools::request($most_recent_filename,"1",$entryStart,$entryEnd,$options);
  print "Got server result. Checking it.\n";
  # search the result for the actual used entry.
  # print $result;
  if($result =~ /<entry>(\d*)<\/entry>/) {
    $most_recent_gate = $1;
    print "Got entry = $most_recent_gate \n";
    open(LASTFILE,">live_file.txt");
    print LASTFILE $most_recent_filename . ";" . $most_recent_mtime . ";" . $entryStart . ";" . $gate_first_served;
    close LASTFILE;

    # open(LASTXML,">live_file.xml");
    # print LASTXML $result;
    
    #hmm... what do I do if this ISN'T filled?
  }
  print "]]></serve_event_logging>";
  print $result;
  print "</serving>";

  exit 0;
}

