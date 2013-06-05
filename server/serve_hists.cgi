#!/usr/bin/perl -w
use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use ArgoServerTools qw(setup myerror);

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

$pathglob = "hists.root";
if(defined param('filename')) {
  $pathglob = param('filename');
}

$hists = param('hists');
$options = param('options');


my $print_pathglob = $pathglob;
$print_pathglob =~ s/ /\n<br\/>\n/g;
print "serve_hists.cgi looking in pathglob: $print_pathglob\n<br/>\n";

@files_raw = glob($pathglob);

# This is a good place to remove some false-positives from the fileglob:
@files = @files_raw;

if((@files)==0) {
    myerror("Couldn't find file for this event specification.");
}

print "serve_hists.cgi found " . scalar(@files) . " files\n<br/>\n";

$filename = $files[0];

my $resp = ArgoServerTools::request($filename,$hists,$options);

ArgoServerTools::serve($resp);
