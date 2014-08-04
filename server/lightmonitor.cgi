#!/usr/bin/perl -w
use IO::Handle qw( );  # For flush
use File::Tail;
use Time::HiRes qw(usleep nanosleep gettimeofday);

print "Content-Type: text/event-stream\r\n";
print "Cache-Control: no-cache\r\n";
print "\r\n";

#
# print "data: last event id:" . $ENV{"HTTP_LAST_EVENT_ID"} . "\n\n";
# STDOUT->flush();

# find the file.
@files = glob("data/lightmonitor_*.pjson");

# pick the most recent based on timestamp
@sortfiles = sort @files;
$filename = pop @sortfiles;

print 'data: {"filename":"' .$filename . '"};\n\n';
STDOUT->flush();

$id = 0;

# while(1)
# {
#   usleep(100000);
#   ($seconds, $microseconds) = gettimeofday;
#   print "data: " . $seconds . " " . $microseconds  . "\n\n";
#    STDOUT->flush();
#
# }


# interval sets the time before checking the file for the first time.
# tail sets the number of lines to read out on the first pass.
# $file=File::Tail->new(name=>$filename, interval=>0.1, tail=>10);
# while (defined($line=$file->read)) {
#   $id++;
#   chomp $line;
#   print "id: " . $id . "\n";
#   print "data: " . $line . "\n\n";
#   STDOUT->flush();
# }

#
$timeout = 1; # 1 second timeout before giveing up.
$tail = 0;
if($ENV{"HTTP_LAST_EVENT_ID"} ne ""){ $tail = 10; }

$file=File::Tail->new(name=>$filename, interval=>0.05, tail=>$tail);
my @selectlist=();
push(@selectlist,$file);

while(1) {
  ($nfound,$timeleft,@pending)=
            File::Tail::select(undef,undef,undef,$timeout,@selectlist);
  unless ($nfound) {
    # timeout
    return; # close this socket. Let the browswer to go error-and-open.
  } else {
    foreach (@pending) {
        $id++;
        $line = $_->read;
        chomp $line;
        print "id: " . $id . "\n";
        print "data: " . $line . "\n\n";
        STDOUT->flush();

     }
  }

}


