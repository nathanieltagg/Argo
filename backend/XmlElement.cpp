//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "XmlElement.h"

std::ostream& operator<< (std::ostream& out, const XmlElement& e)
{
  out << e.str();
}


std::string encodeForXml( const std::string &sSrc )
{
    std::ostringstream sRet;

    for( std::string::const_iterator iter = sSrc.begin(); iter!=sSrc.end(); iter++ )
    {
         unsigned char c = (unsigned char)*iter;

         switch( c )
         {
             case '&': sRet << "&amp;"; break;
             case '<': sRet << "&lt;"; break;
             case '>': sRet << "&gt;"; break;
             case '"': sRet << "&quot;"; break;
             case '\'': sRet << "&apos;"; break;

             default:
              if ( c<32 || c>127 )
              {
                   sRet << "&#" << (unsigned int)c << ";";
              }
              else
              {
                   sRet << c;
              }
         }
    }

    return sRet.str();
}
