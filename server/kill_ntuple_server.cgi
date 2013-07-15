#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
  use POSIX qw(strftime);
use POSIX ();

$exec_name = 'argo-backend';

print header();

do("../config/server_config.pl"); #|| die; # load file if present.

print start_html("kill_ntuple_server.cgi");
print "<pre>";

print "BEFORE: -------- \n";
system("ps aux | grep $exec_name");

print "\n\n";

# kill any existing service, if PID file exists.
if(-r "ntuple_server.pid") {
	open PIDFILE,"<$exec_name.pid";
	$pid = <PIDFILE>;
	close PIDFILE;
	print "PID file exists - had pid $pid \n";
        print "Deleting PID file.";
        unlink "$exec_name.pid";
}


if(defined param('all')) {
  $cmd='/usr/bin/killall -s SIGKILL -v $exec_name';
  print "Running $cmd";
  system($cmd);
} else {
  if( defined param('pid') ) {
    $pid = param('pid');
    print "Using supplied pid $pid \n";
  }

  if(defined($pid)) {
    print "Trying to kill pid $pid\n";
  #  print("kill -s SIGKILL $pid \n");
  #  system('kill -s SIGKILL $pid');
    kill &POSIX::SIGHUP, $pid;
    print "done \n";
    unlink "$exec_name.pid";
  } else {
    print "No PID supplied. Use ?all or ?pid=xxxx to specify a kill target.\n\n";
  }
}

sleep(2);
print "\n\nAFTER: -------- \n";
system("ps aux | grep $exec_name");


print "</pre>";
print end_html;
