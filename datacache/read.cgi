#!/usr/bin/perl -w
use CGI::Pretty;
# use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
use Data::Dumper;

open STDERR, ">>", "read.log";

my $query = new CGI;
# print STDERR $query->Dump;


$filename = $query->param('filename');
$filename=~s/\//___/g;

print STDERR "Serving $filename\n";
#escape all slashes so user can't muck up my filesystem.
if(-r $filename) {
  my $length = (stat($filename)) [10];
  my $type = 'image/png';
  print $query->header({type=>$type,
                     expires=>'+1m',
                     content_length=>$length});
  binmode STDOUT;
  open(FH,"<",$filename);
  my $buff = "";
  while(read(FH,$buff,20240)) { print $buff; }
  close(FH);
  unlink $filename;       
  print STDERR "Deleted $filename\n";
}

#do cleanup. Look for any .png files that are too old

foreach $file (glob("*.png")) {
  print STDERR "Considering old file $file: " . (-M $file) . " days old\n";
  if( (-M $file) > 3 ) {
	unlink $file; 
        print STDERR "Deleting old file $file.\n"; 
  }
}


