#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;

# The idea here is to replace "libs/MyThing.js"
# with "libs/MyThing.123123123.js" 
# where the number is the 10-digit modification time of the file.
# Then the .htaccess RewriteRule directive changes this so it finds MyThing.js

# This is cool because it means that user's caches will never pull old versions of the javascript!

print header;
print "<!-- CODE GENERATED BY libraries.cgi to do auto-versioning -->\n";
# print start_html;
open LIBRARIES,"html/libraries.inc";
# print "<!-- Auto parsed from libraries.cgi -->\n";
while(<LIBRARIES>) {
  # if( /src\=\"libs\/(.*).js\"/ ) {
  #   $mtime = (stat("libs/$1.js"))[9];
  #   $_ =~ s/src\=\"(.*).js\"/src\=\"$1.$mtime.js\"/;
  # }
  # if( /src\=\"core\/(.*).js\"/ ) {
  #   $mtime = (stat("core/$1.js"))[9];
  #   $_ =~ s/src\=\"(.*).js\"/src\=\"$1.$mtime.js\"/;
  # }
  # if( /src\=\"js\/(.*).js\"/ ) {
  #   $mtime = (stat("js/$1.js"))[9];
  #   $_ =~ s/src\=\"(.*).js\"/src\=\"$1.$mtime.js\"/;
  # }
  print;
};
