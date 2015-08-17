#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
  use POSIX qw(strftime);
use POSIX ();

$exec_name = 'argo-live-backend';

print header();

print start_html("restart_live");

my $fast = param("fast") || 0;

print "<p>Fast mode:";
if($fast) { 
        print "TURNING ON".br;
        $cmd='cd ../config; rm live.config; ln -sf live.config.near2_fast live.config; ls -l';
        print $cmd . br;
        print "<pre>";
        system($cmd);
        print "</pre>";
}
else { 
        print "TURNING OFF".br;
        $cmd='cd ../config; rm live.config;  ln -sf live.config.near2 live.config; ls -l';
        print $cmd . br;
        print "<pre>";
        system($cmd);
        print "</pre>";
}
print "</p>";


# kill any existing service, if PID file exists.
my $pidfile = "../backend/${exec_name}.pid";
if(-r $pidfile) {
        open PIDFILE,"<$pidfile";
        $pid = <PIDFILE>;
        close PIDFILE;
        print "PID file exists - had pid $pid ".br;
        print "Trying to kill pid $pid".br;
        kill &POSIX::SIGHUP, $pid;
        print "done".br;
        print "Deleting PID file.".br;
        unlink $pidfile;
} else {
        $cmd="/usr/bin/killall -s SIGKILL -v $exec_name";
        print "Running $cmd".br;
        print "<pre>";
        system($cmd);
        print "</pre>";
}




print end_html;
