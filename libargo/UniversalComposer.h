#ifndef UNIVERAL_COMPOSER_H
#define UNIVERAL_COMPOSER_H

#include "Composer.h"

// 
// A composer that creates a specific instance of another composer,
// created to match the file type it's asked to read.
// 
class UniversalComposer : public Composer
{
  public:
   UniversalComposer();
   virtual ~UniversalComposer();
   
   virtual Output_t satisfy_request(Request_t);

   std::shared_ptr<Composer> m_composer;
   std::string m_filename;
 };


#endif /* end of include guard: COMPOSERFACTORY_H_2774D6C0 */
