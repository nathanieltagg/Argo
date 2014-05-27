#!/usr/bin/perl -w
use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use File::Spec;
use ArgoServerTools qw(setup myerror);

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This version is cleverer from _inline: it uses a running root session
# and makes a request via sockets!
#

my $start_time = Time::HiRes::gettimeofday();


ArgoServerTools::setup();
open(PROFLOG,">>serve_event_profile.log");


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


$filename = $files[0];
$absolute_filename = File::Spec->rel2abs($filename);

my $resp = ArgoServerTools::request($absolute_filename,$selection,$entrystart,$entryend,param('options'));

my $req_time = Time::HiRes::gettimeofday();


my $download=0;
if(defined param('download')) { $download = 1; }

ArgoServerTools::serve($resp,$download);

my $serve_time =  Time::HiRes::gettimeofday();

print PROFLOG "Time to req: " . ($req_time - $start_time) . " time to serve: " . ($serve_time - $req_time) . "\n";


