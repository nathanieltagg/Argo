#!/usr/bin/perl -w
use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use ArgoServerTools qw(setup myerror);
use URI::Escape;

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This version is cleverer from _inline: it uses a running root session
# and makes a request via sockets!
#



ArgoServerTools::setup();

my @paths_to_check = ("/","./data","/online/om","/datalocal/om", "./data/");
$fileglob = "current.root";


if( -r "server_config.pl" ) {
    require "server_config.pl";
}  

@names = param;
print("Parameters recieved: ");
print join(",",@names);
print " <br/>";

$hists = param('hists') || "HLIST";
$options = param('options');


if(defined param('filename')) {
  print "Filename defined as " . param('filename');
  $fileglob = uri_unescape(param('filename'));
} else {
  print "Filename undefined <br/>";
  $run = 1;
  $subrun = "*";
  if( defined param('run')    ) {$run    = sprintf("%08d",param('run'));       }
  if( defined param('subrun') ) {$subrun = sprintf("%03d",param('subrun')); }

  print "Using run: -" . $run . "-<br/>";
  print "Using subrun: -" . $subrun . "-<br/>";
  $fileglob = "run_" . $run . "_" . $subrun .".om.root";    
}

@files_raw = ();
$pathglob = "";
foreach $p (@paths_to_check) {
  $pathglob .= "$p/$fileglob ";
  push(@files_raw,glob("$p/$fileglob"));  
}

# This is a good place to remove some false-positives from the fileglob:
@files = ();
foreach $f (@files_raw)
{
  if( -r $f ){push(@files,$f);}
}


my $print_pathglob = $pathglob;
$print_pathglob =~ s/ /<br\/>/g;
print "serve_hists.cgi looking in pathglob: $print_pathglob<br/>\n";



if((@files)==0) {
    myerror("Couldn't find file for this event specification.");
}

print "serve_hists.cgi found " . scalar(@files) . " files\n<br/>\n";

$filename = $files[0];

my $resp = ArgoServerTools::request($filename,$hists,$options);

ArgoServerTools::serve($resp);

#remove old log files, more than 1/2 day old.
for ( glob "request_*.log" ) {
  unlink $_ if ( -M $_ > 0.5 );
}
