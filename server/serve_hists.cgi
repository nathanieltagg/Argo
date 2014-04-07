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


if( -r "server_config.pl" ) {
    require "server_config.pl";
}  

$hists = param('hists') || "HLIST";
$options = param('options');

my @paths_to_check = ("/",".","/online/om");
$fileglob = "current.root";

if(defined param('filename')) {
  $fileglob = uri_unescape(param('filename'));
} else {
  $run = 1;
  $subrun = 0;
  if( defined param('run')    ) {$run = param('run');       }
  if( defined param('subrun') ) {$subrun = param('subrun'); }
  $fileglob = "run_" . sprintf("%08d",$run) . "_" . sprintf("%03d",$subrun) .".om.root";    
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
