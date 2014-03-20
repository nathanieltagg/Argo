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

my $pathglob =""; # Default event.
my $selection = "1";
my $entrystart = 0;
my $entryend = 1000000000;

if(defined param('selection')) {
    $selection=param('selection');
}

if(defined param('entry')) {
    $entrystart=param('entry');
}


if(defined param('filename')){
    # 
    # Requested a DST file.
    #
    $pathglob=param('filename');
} 

my $print_pathglob = $pathglob;
$print_pathglob =~ s/ /\n<br\/>\n/g;
print "serve_event.cgi looking in pathglob: $print_pathglob\n<br/>\n";

@files_raw = glob($pathglob);

# This is a good place to remove some false-positives from the fileglob:
@files = @files_raw;

if((@files)==0) {
    myerror("Couldn't find file for this event specification.");
}

print "serve_event.cgi found " . scalar(@files) . " files\n<br/>\n";

$filename = $files[0];

my $resp = ArgoServerTools::request($filename,$selection,$entrystart,$entryend,param('options'));

my $download=0;
if(defined param('download')) { $download = 1; }

ArgoServerTools::serve($resp,$download);



