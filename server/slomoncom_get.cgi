#!/usr/bin/perl -w

use DBI;
use CGI qw/:standard/;
#use DateTime::Format::DBI;

print header(-type => 'application/json',
               -Access_Control_Allow_Origin => "*");
               
$dbh = DBI->connect("dbi:Pg:dbname=slowmoncon_archive;host=smc-priv", "smcreader", "argon!smcReader");

my $channel_name;
$channel_name = "uB_TPCDrift_HV01_1_0/voltage";
if(defined param('channel')) {
  $channel_name = param('channel');
}

my $channel_id = $dbh->selectrow_array("select channel_id from channel where name like ?",
  undef,$channel_name);

#my $date = '2015-09-21 14:30:00';
my $date = param('t');

my $tolerance = "60 s"; #seconds

my ($avg,$rms,$count,$interpdate) = $dbh->selectrow_array("select avg(float_val), stddev(float_val), count(float_val), cast(? as timestamp with time zone) from sample "
    ."where channel_id = ? "
    ."and smpl_time > cast(? as timestamp with time zone) - cast(? as interval) "
    ."and smpl_time < cast(? as timestamp with time zone) + cast(? as interval);",
  undef, $date, $channel_id, $date, $tolerance, $date, $tolerance );

  
if($count==0) {
  print "{\"error\": \"No results\", \"date\":\"$interpdate\", \"count\":0, \"channel_name\":\"$channel_name\", \"channel_id\":$channel_id}";
} else {
  print "{\"date\":\"$interpdate\", \"avg\":$avg, \"rms\":$rms, \"count\":$count, \"channel_name\":\"$channel_name\", \"channel_id\":$channel_id}";
}

